import { describe, expect, it } from "vitest";
import {
  checkGuardInvariants,
  initialGuardBrain,
  selectGuardEvent,
  stepGuard,
  type GuardBrain,
  type GuardContext,
  type GuardObservations,
  type GuardStateName,
  type TransitionRecord,
} from "../../src/domain/behavior/guardFsm";
import type { Vector2 } from "../../src/domain/model/vector";
import type { PerceptionSource } from "../../src/domain/perception/memory";

const TIMINGS = { searchDurationMs: 3000 };
const PATROL_POINTS = 4;
const NOTHING: GuardObservations = {
  visiblePlayerPosition: null,
  heardSoundPosition: null,
  routeFailure: null,
  destinationReached: false,
};

interface Step {
  readonly t: number;
  readonly obs?: Partial<GuardObservations>;
}

/**
 * Drives the FSM like the application layer does: memory follows perception
 * (vision overrides sound in the same instant), one arbitrated event per step,
 * and invariants are checked after every event.
 */
class Harness {
  public brain: GuardBrain = initialGuardBrain();
  public memory: { position: Vector2 | null; source: PerceptionSource | null } = {
    position: null,
    source: null,
  };
  public readonly records: TransitionRecord[] = [];

  public run(steps: readonly Step[]): this {
    for (const step of steps) {
      const obs = { ...NOTHING, ...step.obs };
      if (obs.visiblePlayerPosition) {
        this.memory = { position: obs.visiblePlayerPosition, source: "vision" };
      } else if (obs.heardSoundPosition) {
        this.memory = { position: obs.heardSoundPosition, source: "sound" };
      }
      const context = this.context(step.t);
      const event = selectGuardEvent(this.brain.state, obs);
      const result = stepGuard(this.brain, event, context, TIMINGS);
      this.brain = result.brain;
      this.records.push(result.record);
      expect(checkGuardInvariants(this.brain, context), `t=${step.t}`).toEqual([]);
    }
    return this;
  }

  public states(): GuardStateName[] {
    return this.records.filter((r) => r.kind === "transition").map((r) => r.to);
  }

  private context(t: number): GuardContext {
    return {
      timeMs: t,
      lastKnownPosition: this.memory.position,
      lastKnownSource: this.memory.source,
      patrolPointCount: PATROL_POINTS,
    };
  }
}

const NOISE: Vector2 = { x: 256, y: 96 };
const SEEN: Vector2 = { x: 288, y: 96 };

describe("guard FSM sequences", () => {
  it("Patrullar -> Investigar -> Buscar -> Regresar -> Patrullar", () => {
    const h = new Harness().run([
      { t: 0, obs: { heardSoundPosition: NOISE } },
      { t: 1000, obs: { destinationReached: true } },
      { t: 2000 },
      { t: 4000 },
      { t: 5000, obs: { destinationReached: true } },
    ]);

    expect(h.states()).toEqual(["investigate", "search", "return", "patrol"]);
    expect(h.records.map((r) => r.rule)).toEqual(["T5", "T7", null, "T9", "T10"]);
    expect(h.brain.patrolIndex).toBe(1);
  });

  it.each<[GuardStateName, Step[]]>([
    ["patrol", []],
    ["investigate", [{ t: 0, obs: { heardSoundPosition: NOISE } }]],
    ["search", [
      { t: 0, obs: { heardSoundPosition: NOISE } },
      { t: 100, obs: { destinationReached: true } },
    ]],
    ["return", [
      { t: 0, obs: { heardSoundPosition: NOISE } },
      { t: 100, obs: { destinationReached: true } },
      { t: 3100 },
    ]],
  ])("any active state (%s) -> Perseguir on vision", (from, setup) => {
    const h = new Harness().run(setup);
    expect(h.brain.state).toBe(from);

    h.run([{ t: 5000, obs: { visiblePlayerPosition: SEEN } }]);

    expect(h.brain.state).toBe("chase");
    expect(h.brain.previousState).toBe(from);
    expect(h.records.at(-1)?.rule).toBe("T1");
  });

  it("Perseguir -> Investigar goes to the last seen position, not a later one", () => {
    const h = new Harness().run([
      { t: 0, obs: { visiblePlayerPosition: SEEN } },
      { t: 100 },
    ]);

    expect(h.brain.state).toBe("investigate");
    expect(h.brain.target).toEqual(SEEN);
    expect(h.records.at(-1)?.rule).toBe("T3");
  });
});

describe("guard FSM limits", () => {
  it("vision wins over a simultaneous sound", () => {
    const event = selectGuardEvent("patrol", {
      ...NOTHING,
      visiblePlayerPosition: SEEN,
      heardSoundPosition: NOISE,
    });
    expect(event).toEqual({ type: "player-seen", position: SEEN });

    const h = new Harness().run([
      { t: 0, obs: { visiblePlayerPosition: SEEN, heardSoundPosition: NOISE } },
      { t: 50, obs: { visiblePlayerPosition: SEEN, heardSoundPosition: NOISE } },
    ]);
    expect(h.brain.state).toBe("chase");
    expect(h.memory.source).toBe("vision");
  });

  it("ignores sound while chasing (sound arrives without vision only after loss)", () => {
    const brain = new Harness().run([{ t: 0, obs: { visiblePlayerPosition: SEEN } }]).brain;
    const result = stepGuard(
      brain,
      { type: "sound-heard", position: NOISE },
      { timeMs: 10, lastKnownPosition: SEEN, lastKnownSource: "vision", patrolPointCount: 4 },
      TIMINGS,
    );

    expect(result.brain.state).toBe("chase");
    expect(result.record.kind).toBe("ignored");
  });

  it("false guard: vision lost without memory goes to Buscar (T4), not Investigar", () => {
    const chasing: GuardBrain = { ...initialGuardBrain(), state: "chase", target: SEEN };
    const result = stepGuard(
      chasing,
      { type: "vision-lost" },
      { timeMs: 0, lastKnownPosition: null, lastKnownSource: null, patrolPointCount: 4 },
      TIMINGS,
    );

    expect(result.record.rule).toBe("T4");
    expect(result.brain.state).toBe("search");
  });

  it("search timer: false guard one ms before the limit, transition at the exact limit", () => {
    const h = new Harness().run([
      { t: 0, obs: { heardSoundPosition: NOISE } },
      { t: 1000, obs: { destinationReached: true } },
    ]);
    expect(h.brain.searchEndsAtMs).toBe(4000);

    h.run([{ t: 3999 }]);
    expect(h.brain.state).toBe("search");
    expect(h.records.at(-1)?.guard).toBe("temporizador vigente");

    h.run([{ t: 4000 }]);
    expect(h.brain.state).toBe("return");
  });

  it("repeated events update data without re-entering or resetting timers", () => {
    const h = new Harness().run([
      { t: 0, obs: { heardSoundPosition: NOISE } },
      { t: 50, obs: { heardSoundPosition: NOISE } },
      { t: 100, obs: { heardSoundPosition: { x: 320, y: 96 } } },
    ]);

    expect(h.records.map((r) => r.kind)).toEqual(["transition", "update", "update"]);
    expect(h.brain.enteredAtMs).toBe(0);
    expect(h.brain.target).toEqual({ x: 320, y: 96 });

    h.run([
      { t: 200, obs: { destinationReached: true } },
      { t: 300, obs: { heardSoundPosition: NOISE } },
    ]);
    // Sound during Buscar leaves Buscar (T5), it does not extend the timer.
    expect(h.brain.state).toBe("investigate");
    expect(h.brain.searchEndsAtMs).toBeNull();
  });

  it("an unreachable investigation target recovers by searching (T8)", () => {
    const h = new Harness().run([
      { t: 0, obs: { heardSoundPosition: NOISE } },
      { t: 50, obs: { routeFailure: "unreachable" } },
    ]);

    expect(h.records.at(-1)?.rule).toBe("T8");
    expect(h.brain.state).toBe("search");
    expect(h.brain.searchEndsAtMs).toBe(3050);
  });

  it("unreachable patrol points are skipped and finally reported as stalled", () => {
    const h = new Harness().run([
      { t: 0, obs: { routeFailure: "unreachable" } },
      { t: 10, obs: { routeFailure: "unreachable" } },
      { t: 20, obs: { routeFailure: "unreachable" } },
    ]);
    expect(h.records.map((r) => r.rule)).toEqual(["T12", "T12", "T12"]);
    expect(h.brain.patrolIndex).toBe(3);
    expect(h.brain.stalled).toBe(false);

    h.run([{ t: 30, obs: { routeFailure: "unreachable" } }]);
    expect(h.records.at(-1)?.rule).toBe("T13");
    expect(h.brain.stalled).toBe(true);
  });

  it("reset during a chase restores the complete initial state", () => {
    const h = new Harness().run([{ t: 0, obs: { visiblePlayerPosition: SEEN } }]);
    expect(h.brain.state).toBe("chase");

    const restarted = new Harness();
    expect(restarted.brain).toEqual(initialGuardBrain());
    expect(restarted.memory.position).toBeNull();
    expect(restarted.brain.state).toBe("patrol");
    expect(restarted.brain.patrolIndex).toBe(0);
  });

  it("rejects non-finite time and positions", () => {
    const context = { timeMs: Number.NaN, lastKnownPosition: null, lastKnownSource: null, patrolPointCount: 4 };
    expect(() => stepGuard(initialGuardBrain(), { type: "tick" }, context, TIMINGS)).toThrow();
    expect(() => stepGuard(
      initialGuardBrain(),
      { type: "sound-heard", position: { x: Number.POSITIVE_INFINITY, y: 0 } },
      { ...context, timeMs: 0 },
      TIMINGS,
    )).toThrow();
  });
});

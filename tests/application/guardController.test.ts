import { describe, expect, it } from "vitest";
import {
  initialGuardController,
  updateGuard,
  type GuardControllerConfig,
  type GuardControllerState,
} from "../../src/application/simulation/guardController";
import { LAB_GUARD_CONFIG, SOUND_DURATION_MS, SOUND_RADIUS } from "../../src/application/simulation/labGuard";
import { PLAYER_START } from "../../src/application/simulation/labLevel";
import type { TransitionRecord } from "../../src/domain/behavior/guardFsm";
import { cellCenter, createGridMap, isWalkable, worldToCell, type GridPoint } from "../../src/domain/model/grid";
import type { Vector2 } from "../../src/domain/model/vector";

const STEP_MS = 50;
const center = (point: GridPoint): Vector2 => cellCenter(point, LAB_GUARD_CONFIG.tileSize);

interface Scenario {
  readonly config?: GuardControllerConfig;
  readonly untilMs: number;
  readonly stepMs?: number;
  readonly player: (timeMs: number) => Vector2;
  readonly soundsAt?: readonly number[];
}

interface Run {
  readonly state: GuardControllerState;
  readonly transitions: TransitionRecord[];
  readonly trace: string[];
  readonly maxChaseSearchesPerSecond: number;
}

/** Deterministic simulation with injected time: same input, same trace. */
function simulate(scenario: Scenario): Run {
  const config = scenario.config ?? LAB_GUARD_CONFIG;
  const stepMs = scenario.stepMs ?? STEP_MS;
  let state = initialGuardController(config);
  const transitions: TransitionRecord[] = [];
  const trace: string[] = [];
  const chaseSearches: number[] = [];

  for (let time = 0; time <= scenario.untilMs; time += stepMs) {
    const player = scenario.player(time);
    const newSound = scenario.soundsAt?.includes(time)
      ? { position: player, radius: SOUND_RADIUS, emittedAtMs: time, durationMs: SOUND_DURATION_MS }
      : null;
    const searchesBefore = state.route.searches;
    const result = updateGuard(state, config, { timeMs: time, deltaMs: stepMs, playerPosition: player, newSound });

    expect(result.violations, `t=${time}`).toEqual([]);
    expect(isWalkable(config.map, worldToCell(result.state.position, config.tileSize)), `t=${time}`).toBe(true);
    if (result.state.brain.state === "chase" && result.state.route.searches > searchesBefore) {
      chaseSearches.push(time);
    }

    if (result.record.kind === "transition") {
      transitions.push(result.record);
      const memory = result.state.perception.memory;
      const known = memory.lastKnownPosition
        ? `${memory.source}@${cell(memory.lastKnownPosition)}`
        : "-";
      const route = result.state.route.result;
      trace.push(
        `t=${String(time).padStart(5)} ${result.record.from} --${result.record.event}`
        + `${result.record.eventPosition ? `(${cell(result.record.eventPosition)})` : ""}`
        + ` [${result.record.guard}]--> ${result.record.to} {${result.record.rule}}`
        + ` acciones=${result.record.actions.join("; ")}`
        + ` | vision=${result.vision.reason} memoria=${known}`
        + ` ruta=${route ? `${route.status} costo ${route.totalCost ?? "-"}` : "ninguna"}`,
      );
    }
    state = result.state;
  }

  let maxPerSecond = 0;
  for (const t of chaseSearches) {
    maxPerSecond = Math.max(maxPerSecond, chaseSearches.filter((other) => other >= t && other < t + 1000).length);
  }
  return { state, transitions, trace, maxChaseSearchesPerSecond: maxPerSecond };
}

function cell(position: Vector2): string {
  const point = worldToCell(position, LAB_GUARD_CONFIG.tileSize);
  return `${point.x},${point.y}`;
}

describe("guard controller on the lab map (AC5 traces)", () => {
  it("normal case: sound -> investigate -> search -> return -> patrol", () => {
    // Player behind the guard makes a noise at t=100, then is far away and hidden.
    const run = simulate({
      untilMs: 16000,
      soundsAt: [100],
      player: (t) => (t <= 100 ? center({ x: 28, y: 17 }) : center(PLAYER_START)),
    });

    console.info(["[traza caso normal]", ...run.trace].join("\n"));
    expect(run.transitions.map((r) => r.to)).toEqual(["investigate", "search", "return", "patrol"]);
    expect(run.transitions.map((r) => r.rule)).toEqual(["T5", "T7", "T9", "T10"]);
    expect(run.transitions[0]?.eventPosition).toEqual(center({ x: 28, y: 17 }));
    const searchStart = run.transitions[1]!.timeMs;
    expect(run.transitions[2]!.timeMs - searchStart).toBe(3000);
    expect(run.state.brain.state).toBe("patrol");
  });

  it("limit case: simultaneous sound and vision, then hiding behind a wall", () => {
    const seen = center({ x: 24, y: 17 });
    const hidden = center({ x: 20, y: 13 });
    const run = simulate({
      untilMs: 12000,
      soundsAt: [0],
      player: (t) => (t < 1000 ? seen : hidden),
    });

    console.info(["[traza caso limite]", ...run.trace].join("\n"));
    expect(run.transitions.map((r) => r.to)).toEqual(["chase", "investigate", "search", "return", "patrol"]);
    // Vision has priority over the sound emitted in the same instant.
    expect(run.transitions[0]).toMatchObject({ timeMs: 0, event: "player-seen", rule: "T1" });
    // After losing sight it goes to the last SEEN position, never to the hidden one.
    const lost = run.transitions[1]!;
    expect(lost.rule).toBe("T3");
    expect(run.state.perception.memory.lastKnownPosition).toEqual(seen);
    // Re-planning while chasing is throttled (no search every frame).
    expect(run.maxChaseSearchesPerSecond).toBeLessThanOrEqual(5);
  });

  it("unreachable investigation target recovers by searching (T8)", () => {
    const pocketMap = createGridMap(7, 3, [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]);
    const config: GuardControllerConfig = {
      ...LAB_GUARD_CONFIG,
      map: pocketMap,
      guardStart: { x: 1, y: 1 },
      patrolPoints: [{ x: 1, y: 1 }],
    };
    const run = simulate({
      config,
      untilMs: 4000,
      soundsAt: [100],
      player: () => center({ x: 5, y: 1 }),
    });

    console.info(["[traza inaccesible]", ...run.trace].join("\n"));
    expect(run.transitions.map((r) => r.rule)).toEqual(["T5", "T8", "T9", "T10"]);
    expect(run.transitions[1]!.actions[0]).toBe("recuperacion: unreachable");
  });

  it.each([
    [20, 17, 6, 26],
    [22, 18, 16, 16],
    [21, 18, 26, 8],
    [22, 16, 16, 16],
    [20, 18, 4, 28],
  ])(
    "regression (playtest 2026-11-10): no back-and-forth with the player still at cell %i,%i",
    (cx, cy, ox, oy) => {
      // Player stands still, possibly off-centre and beside the guard's lane.
      const still = { x: cx * 32 + ox, y: cy * 32 + oy };
      const run = simulate({ untilMs: 8000, player: () => still });

      console.info([`[traza regresion jugador quieto ${cx},${cy}]`, ...run.trace].join("\n"));
      // It may lose sight briefly while turning, but it must settle in Perseguir:
      // no chase/investigate flips after the first 3 s.
      const lateFlips = run.transitions.filter(
        (r) => r.timeMs > 3000 && (r.rule === "T1" || r.rule === "T3"),
      );
      expect(lateFlips).toEqual([]);
      expect(run.state.brain.state).toBe("chase");
    },
  );

  it("a large time step never leaves walkable cells", () => {
    const run = simulate({
      untilMs: 20000,
      stepMs: 2000,
      player: () => center(PLAYER_START),
    });
    expect(run.state.brain.state).toBe("patrol");
  });

  it("is reproducible and fully reset by re-initialising", () => {
    const scenario: Scenario = {
      untilMs: 3000,
      soundsAt: [0],
      player: () => center({ x: 24, y: 17 }),
    };
    const first = simulate(scenario);
    const second = simulate(scenario);
    expect(second.trace).toEqual(first.trace);
    expect(first.state.brain.state).toBe("chase");

    // Reset during the chase: the scene restarts with a fresh controller.
    const fresh = initialGuardController(LAB_GUARD_CONFIG);
    expect(fresh.brain.state).toBe("patrol");
    expect(fresh.perception.memory.lastKnownPosition).toBeNull();
    expect(fresh.route.result).toBeNull();
    expect(fresh.log).toEqual([]);
    expect(fresh.position).toEqual(center(LAB_GUARD_CONFIG.guardStart));
  });

  it("rejects a non-walkable patrol point at configuration time", () => {
    expect(() => initialGuardController({
      ...LAB_GUARD_CONFIG,
      patrolPoints: [{ x: 0, y: 0 }],
    })).toThrow(/not walkable/);
  });
});

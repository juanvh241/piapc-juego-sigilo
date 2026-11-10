import { describe, expect, it } from "vitest";
import {
  checkGuardInvariants,
  initialGuardBrain,
  stepGuard,
  type GuardBrain,
  type GuardContext,
  type GuardEvent,
} from "../../src/domain/behavior/guardFsm";

// Upgrade 1 — docs/upgrades/01-patrulla-pausas-mirada/spec.md
const TIMINGS = { searchDurationMs: 3000, patrolPauseMs: 1500 };
const SEEN = { x: 300, y: 300 };

function ctx(timeMs: number, seen = false): GuardContext {
  return {
    timeMs,
    lastKnownPosition: seen ? SEEN : null,
    lastKnownSource: seen ? "vision" : null,
    patrolPointCount: 4,
  };
}

function step(brain: GuardBrain, event: GuardEvent, context: GuardContext) {
  const result = stepGuard(brain, event, context, TIMINGS);
  expect(checkGuardInvariants(result.brain, context)).toEqual([]);
  return result;
}

describe("upgrade 1: patrol pause (domain)", () => {
  it("U1-AC1: arriving at a patrol point starts a 1500 ms pause that ends at the exact limit", () => {
    let brain = step(initialGuardBrain(), { type: "destination-reached" }, ctx(1000)).brain;
    expect(brain.patrolIndex).toBe(1);
    expect(brain.pauseEndsAtMs).toBe(2500);

    const before = step(brain, { type: "tick" }, ctx(2499));
    expect(before.record.kind).toBe("ignored");
    expect(before.brain.pauseEndsAtMs).toBe(2500);

    const atLimit = step(before.brain, { type: "tick" }, ctx(2500));
    expect(atLimit.record.rule).toBe("T14");
    brain = atLimit.brain;
    expect(brain.pauseEndsAtMs).toBeNull();
    expect(brain.patrolIndex).toBe(1);
  });

  it("a repeated arrival during the pause does not skip a patrol point", () => {
    const paused = step(initialGuardBrain(), { type: "destination-reached" }, ctx(0)).brain;
    const repeated = step(paused, { type: "destination-reached" }, ctx(100));

    expect(repeated.record.kind).toBe("ignored");
    expect(repeated.brain.patrolIndex).toBe(1);
  });

  it("U1-AC3: vision during the pause goes straight to Perseguir and drops the pause", () => {
    const paused = step(initialGuardBrain(), { type: "destination-reached" }, ctx(0)).brain;
    const chased = step(paused, { type: "player-seen", position: SEEN }, ctx(400, true));

    expect(chased.record.rule).toBe("T1");
    expect(chased.brain.state).toBe("chase");
    expect(chased.brain.pauseEndsAtMs).toBeNull();
  });

  it("Regresar -> Patrullar also pauses at the reached point", () => {
    const returning: GuardBrain = { ...initialGuardBrain(), state: "return", patrolIndex: 2 };
    const result = step(returning, { type: "destination-reached" }, ctx(5000));

    expect(result.record.rule).toBe("T10");
    expect(result.brain.pauseEndsAtMs).toBe(6500);
    expect(result.brain.patrolIndex).toBe(3);
  });

  it("pause 0 (default) keeps the previous behaviour", () => {
    const result = stepGuard(initialGuardBrain(), { type: "destination-reached" }, ctx(0), {
      searchDurationMs: 3000,
    });
    expect(result.brain.pauseEndsAtMs).toBeNull();
  });
});

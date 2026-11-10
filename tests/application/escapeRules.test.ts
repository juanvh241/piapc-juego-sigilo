import { describe, expect, it } from "vitest";
import { canEscape, checkTakedown, isCaught, type TakedownInput } from "../../src/application/simulation/escapeRules";
import { initialGuardController, updateGuard } from "../../src/application/simulation/guardController";
import { LAB_GUARD_CONFIG } from "../../src/application/simulation/labGuard";
import {
  checkGuardInvariants,
  GUARD_STATES,
  initialGuardBrain,
  stepGuard,
  type GuardEvent,
} from "../../src/domain/behavior/guardFsm";
import { cellCenter } from "../../src/domain/model/grid";

// specs/tp-05-cuchillo-y-escape.md
const VALID: TakedownInput = {
  hasKnife: true,
  guard: { x: 100, y: 100 },
  guardFacing: { x: 1, y: 0 },
  player: { x: 70, y: 100 }, // 30 px behind (guard looks east, player is west)
  guardState: "patrol",
  fieldOfViewRadians: Math.PI / 2,
};

describe("TP-05 takedown conditions (E)", () => {
  it("valid: knife, close, from behind, not chasing", () => {
    expect(checkTakedown(VALID)).toEqual({ ok: true });
  });

  it.each<[string, Partial<TakedownInput>, string]>([
    ["without knife", { hasKnife: false }, "sin-cuchillo"],
    ["too far (41 px)", { player: { x: 59, y: 100 } }, "lejos"],
    ["in front of the guard", { player: { x: 130, y: 100 } }, "de-frente"],
    ["while chasing", { guardState: "chase" }, "persiguiendo"],
    ["already neutralized", { guardState: "neutralized" }, "ya-neutralizado"],
  ])("invalid %s", (_label, change, reason) => {
    expect(checkTakedown({ ...VALID, ...change })).toEqual({ ok: false, reason });
  });

  it("exact limits: 40 px is close enough; the cone edge (45°) counts as in front", () => {
    expect(checkTakedown({ ...VALID, player: { x: 60, y: 100 } })).toEqual({ ok: true });
    const edge = { x: 100 + 20, y: 100 + 20 };
    expect(checkTakedown({ ...VALID, player: edge })).toEqual({ ok: false, reason: "de-frente" });
  });
});

describe("TP-05 Neutralizado is terminal", () => {
  it("T15 from every active state, then ignores every event", () => {
    const events: GuardEvent[] = [
      { type: "player-seen", position: { x: 1, y: 1 } },
      { type: "vision-lost" },
      { type: "sound-heard", position: { x: 1, y: 1 } },
      { type: "route-failed", reason: "unreachable" },
      { type: "destination-reached" },
      { type: "tick" },
      { type: "neutralized" },
    ];
    for (const state of GUARD_STATES.filter((s) => s !== "neutralized")) {
      const ctx = { timeMs: 0, lastKnownPosition: { x: 1, y: 1 }, lastKnownSource: "vision" as const, patrolPointCount: 4 };
      const from = { ...initialGuardBrain(), state, target: { x: 1, y: 1 }, searchEndsAtMs: 10 };
      const down = stepGuard(from, { type: "neutralized" }, ctx, { searchDurationMs: 3000 });
      expect(down.record.rule).toBe("T15");
      expect(down.brain.state).toBe("neutralized");
      expect(checkGuardInvariants(down.brain, ctx)).toEqual([]);
      for (const event of events) {
        const after = stepGuard(down.brain, event, { ...ctx, timeMs: 99_999 }, { searchDurationMs: 3000 });
        expect(after.brain.state).toBe("neutralized");
        expect(after.record.kind).toBe("ignored");
      }
    }
  });

  it("a neutralized guard does not move or react in the controller", () => {
    let state = initialGuardController(LAB_GUARD_CONFIG);
    state = updateGuard(state, LAB_GUARD_CONFIG, {
      timeMs: 0, deltaMs: 50, playerPosition: cellCenter({ x: 2, y: 2 }, 32), newSound: null, neutralize: true,
    }).state;
    const position = state.position;
    for (let t = 50; t <= 3000; t += 50) {
      // Player in front and a loud noise: still nothing.
      const result = updateGuard(state, LAB_GUARD_CONFIG, {
        timeMs: t,
        deltaMs: 50,
        playerPosition: cellCenter({ x: 25, y: 17 }, 32),
        newSound: t === 100 ? { position: cellCenter({ x: 26, y: 17 }, 32), radius: 220, emittedAtMs: t, durationMs: 800 } : null,
      });
      expect(result.violations).toEqual([]);
      state = result.state;
    }
    expect(state.brain.state).toBe("neutralized");
    expect(state.position).toEqual(position);
  });
});

describe("TP-05 capture and escape", () => {
  it("caught only while chasing and closer than 16 px", () => {
    const guard = { x: 100, y: 100 };
    expect(isCaught("chase", guard, { x: 115, y: 100 })).toBe(true);
    expect(isCaught("chase", guard, { x: 116, y: 100 })).toBe(false);
    expect(isCaught("investigate", guard, { x: 100, y: 100 })).toBe(false);
    expect(isCaught("neutralized", guard, { x: 100, y: 100 })).toBe(false);
  });

  it("the door only lets the player out after the takedown", () => {
    const exit = { x: 5, y: 5 };
    expect(canEscape(false, exit, exit)).toBe(false);
    expect(canEscape(true, { x: 5, y: 4 }, exit)).toBe(false);
    expect(canEscape(true, exit, exit)).toBe(true);
  });
});

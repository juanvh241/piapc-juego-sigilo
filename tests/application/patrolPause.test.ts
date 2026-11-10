import { describe, expect, it } from "vitest";
import { initialGuardController, updateGuard, type GuardControllerState } from "../../src/application/simulation/guardController";
import { LAB_GUARD_CONFIG } from "../../src/application/simulation/labGuard";
import { PLAYER_START, TILE_SIZE } from "../../src/application/simulation/labLevel";
import { cellCenter } from "../../src/domain/model/grid";

// Upgrade 1 — docs/upgrades/01-patrulla-pausas-mirada/spec.md
const STEP = 50;
const FAR_PLAYER = cellCenter(PLAYER_START, TILE_SIZE);
const degrees = (v: { x: number; y: number }) => Math.round((Math.atan2(v.y, v.x) * 180) / Math.PI);
/** Normalises to (-180, 180] so that 180 + 45 and -135 compare as the same direction. */
const wrap = (angle: number) => {
  const a = ((angle % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
};

interface Sample {
  readonly t: number;
  readonly state: GuardControllerState;
  readonly rule: string | null;
}

function run(untilMs: number, player = FAR_PLAYER): Sample[] {
  let state = initialGuardController(LAB_GUARD_CONFIG);
  const samples: Sample[] = [];
  for (let t = 0; t <= untilMs; t += STEP) {
    const result = updateGuard(state, LAB_GUARD_CONFIG, { timeMs: t, deltaMs: STEP, playerPosition: player, newSound: null });
    expect(result.violations).toEqual([]);
    state = result.state;
    samples.push({ t, state, rule: result.record.rule });
  }
  return samples;
}

describe("upgrade 1: patrol pause in the controller", () => {
  it("U1-AC1/AC2: at P1 the guard stays still, searches no route and sweeps -45 then +45 degrees", () => {
    const samples = run(9000);
    // Second arrival = P1 (the first one is P0 at the start cell).
    const arrivals = samples.filter((s) => s.rule === "T11");
    const atP1 = arrivals[1]!;
    const start = atP1.t;
    const pause = samples.filter((s) => s.t >= start && s.t < start + 1500);
    const arrivalAngle = degrees(samples[samples.indexOf(atP1) - 1]!.state.facing);

    console.info(`[U1] llegada a P1 en t=${start} ms, mirada de llegada ${arrivalAngle} grados`);
    expect(atP1.state.position).toEqual(cellCenter({ x: 12, y: 17 }, TILE_SIZE));
    expect(new Set(pause.map((s) => `${s.state.position.x},${s.state.position.y}`)).size).toBe(1);
    expect(new Set(pause.map((s) => s.state.route.searches)).size).toBe(1);

    const firstHalf = pause.filter((s) => s.t < start + 750).map((s) => wrap(degrees(s.state.facing)));
    const secondHalf = pause.filter((s) => s.t >= start + 750).map((s) => wrap(degrees(s.state.facing)));
    expect(new Set(firstHalf)).toEqual(new Set([wrap(arrivalAngle - 45)]));
    expect(new Set(secondHalf)).toEqual(new Set([wrap(arrivalAngle + 45)]));

    // Exact end of the pause, then it searches the route to P2 and moves on.
    const end = samples.find((s) => s.t === start + 1500)!;
    expect(end.rule).toBe("T14");
    expect(wrap(degrees(end.state.facing))).toBe(wrap(arrivalAngle));
    const after = samples.find((s) => s.t === start + 1550)!;
    expect(after.state.route.searches).toBeGreaterThan(atP1.state.route.searches);
    expect(after.state.position).not.toEqual(atP1.state.position);
  });

  it("U1-AC3: seeing the player during the pause interrupts it immediately", () => {
    // P0 pause happens at the start (t=50..1550); the player is in front of the guard at t>=500.
    const visible = cellCenter({ x: 24, y: 17 }, TILE_SIZE);
    let state = initialGuardController(LAB_GUARD_CONFIG);
    let chaseAt: number | null = null;
    for (let t = 0; t <= 1600 && chaseAt === null; t += STEP) {
      const player = t >= 500 ? visible : FAR_PLAYER;
      const result = updateGuard(state, LAB_GUARD_CONFIG, { timeMs: t, deltaMs: STEP, playerPosition: player, newSound: null });
      state = result.state;
      if (result.record.rule === "T1") {
        chaseAt = t;
      }
    }

    console.info(`[U1] persecucion durante la pausa en t=${chaseAt} ms`);
    expect(chaseAt).not.toBeNull();
    expect(chaseAt!).toBeLessThan(1550);
    expect(state.brain.pauseEndsAtMs).toBeNull();
  });
});

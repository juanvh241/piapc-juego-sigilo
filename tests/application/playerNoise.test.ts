import { describe, expect, it } from "vitest";
import { initialGuardController, updateGuard } from "../../src/application/simulation/guardController";
import { LAB_GUARD_CONFIG } from "../../src/application/simulation/labGuard";
import {
  GLASS_RADIUS,
  initialPlayerNoise,
  STEP_RADIUS,
  updatePlayerNoise,
  type PlayerNoiseState,
} from "../../src/application/simulation/playerNoise";
import { cellCenter, type GridPoint } from "../../src/domain/model/grid";

// specs/tp-04-ruido-del-jugador.md
const NO_GLASS = new Set<string>();
const at = (cell: GridPoint) => cellCenter(cell, 32);

function walk(state: PlayerNoiseState, t: number, cell: GridPoint, opts: { moving?: boolean; sneaking?: boolean; glass?: ReadonlySet<string> } = {}) {
  return updatePlayerNoise(state, {
    timeMs: t,
    moving: opts.moving ?? true,
    sneaking: opts.sneaking ?? false,
    cell,
    position: at(cell),
    glassKeys: opts.glass ?? NO_GLASS,
  });
}

describe("TP-04 player noise", () => {
  it("normal walking: a step sound every 350 ms (exact limit), radius 70", () => {
    let state = initialPlayerNoise({ x: 1, y: 1 });
    const kinds: Array<[number, string | null]> = [];
    for (const t of [0, 100, 349, 350, 699, 700]) {
      const result = walk(state, t, { x: 1, y: 1 });
      kinds.push([t, result.kind]);
      if (result.sound) expect(result.sound.radius).toBe(STEP_RADIUS);
      state = result.state;
    }
    expect(kinds).toEqual([[0, "step"], [100, null], [349, null], [350, "step"], [699, null], [700, "step"]]);
  });

  it("sneaking (Shift) and standing still make no step sound", () => {
    let state = initialPlayerNoise({ x: 1, y: 1 });
    for (let t = 0; t <= 2000; t += 50) {
      const sneak = walk(state, t, { x: 1, y: 1 }, { sneaking: true });
      expect(sneak.sound).toBeNull();
      state = sneak.state;
    }
    expect(walk(initialPlayerNoise({ x: 1, y: 1 }), 0, { x: 1, y: 1 }, { moving: false }).sound).toBeNull();
  });

  it("glass sounds once per entry, also when sneaking; staying on it is silent", () => {
    const glass = new Set(["2,1"]);
    let state = initialPlayerNoise({ x: 1, y: 1 });
    const enter = walk(state, 0, { x: 2, y: 1 }, { sneaking: true, glass });
    expect(enter.kind).toBe("glass");
    expect(enter.sound?.radius).toBe(GLASS_RADIUS);
    state = enter.state;

    const stay = walk(state, 500, { x: 2, y: 1 }, { sneaking: true, glass });
    expect(stay.sound).toBeNull();
    state = walk(stay.state, 600, { x: 3, y: 1 }, { sneaking: true, glass }).state;

    const reenter = walk(state, 900, { x: 2, y: 1 }, { sneaking: true, glass });
    expect(reenter.kind).toBe("glass");
  });

  it("the start cell never sounds, even with glass", () => {
    const glass = new Set(["1,1"]);
    expect(walk(initialPlayerNoise({ x: 1, y: 1 }), 0, { x: 1, y: 1 }, { sneaking: true, glass }).sound).toBeNull();
  });

  it("integration: a glass noise inside the guard's hearing radius triggers Investigar (T5)", () => {
    // Guard at (27,17) facing west; player behind it at (28,16) steps on glass.
    const glass = new Set(["28,16"]);
    const noise = walk(initialPlayerNoise({ x: 28, y: 15 }), 100, { x: 28, y: 16 }, { sneaking: true, glass });
    expect(noise.kind).toBe("glass");

    let state = initialGuardController(LAB_GUARD_CONFIG);
    const rules: string[] = [];
    for (let t = 0; t <= 300; t += 50) {
      const result = updateGuard(state, LAB_GUARD_CONFIG, {
        timeMs: t,
        deltaMs: 50,
        playerPosition: at({ x: 2, y: 2 }),
        newSound: t === 100 ? noise.sound : null,
      });
      if (result.record.kind === "transition") rules.push(`${result.record.rule}@${t}`);
      state = result.state;
    }
    expect(rules).toEqual(["T5@100"]);
    expect(state.perception.memory.source).toBe("sound");
  });
});

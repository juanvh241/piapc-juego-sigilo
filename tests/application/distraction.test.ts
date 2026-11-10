import { describe, expect, it } from "vitest";
import { throwDistraction } from "../../src/application/simulation/distraction";
import { initialGuardController, updateGuard } from "../../src/application/simulation/guardController";
import { LAB_GUARD_CONFIG } from "../../src/application/simulation/labGuard";
import { LAB_MAP, TILE_SIZE } from "../../src/application/simulation/labLevel";
import { cellCenter, worldToCell, type GridPoint } from "../../src/domain/model/grid";
import type { SoundEvent } from "../../src/domain/perception/perception";

// Upgrade 7 — docs/upgrades/04-distractores-sonoros/spec.md
const center = (p: GridPoint) => cellCenter(p, TILE_SIZE);
const PLAYER = center({ x: 18, y: 17 });

function attempt(target: GridPoint, nowMs = 0, lastThrowMs: number | null = null) {
  return throwDistraction({ player: PLAYER, target: center(target), map: LAB_MAP, tileSize: TILE_SIZE, nowMs, lastThrowMs });
}

describe("upgrade 7: distraction throw rules", () => {
  it("U7-AC1: accepts a free cell 4 cells away and centres the sound on it", () => {
    const result = attempt({ x: 22, y: 17 });
    expect(result).toEqual({
      accepted: true,
      sound: { position: center({ x: 22, y: 17 }), radius: 190, emittedAtMs: 0, durationMs: 800 },
    });
  });

  it("U7-AC1: range limit is exact: 6 cells (192 px) accepted, 7 cells rejected", () => {
    expect(attempt({ x: 24, y: 17 }).accepted).toBe(true);
    expect(attempt({ x: 25, y: 17 })).toEqual({ accepted: false, reason: "fuera-de-alcance" });
  });

  it("U7-AC1: a wall cell is rejected", () => {
    // (18,15) belongs to the horizontal wall y=15, x=8..24.
    expect(attempt({ x: 18, y: 15 })).toEqual({ accepted: false, reason: "celda-bloqueada" });
  });

  it("U7-AC1: cooldown is exact: 1999 ms rejected, 2000 ms accepted", () => {
    expect(attempt({ x: 22, y: 17 }, 1999, 0)).toEqual({ accepted: false, reason: "enfriamiento" });
    expect(attempt({ x: 22, y: 17 }, 2000, 0).accepted).toBe(true);
  });
});

function simulate(sound: SoundEvent, player = PLAYER, untilMs = 1500) {
  let state = initialGuardController(LAB_GUARD_CONFIG);
  const transitions: string[] = [];
  for (let t = 0; t <= untilMs; t += 50) {
    const newSound = t === sound.emittedAtMs ? sound : null;
    const result = updateGuard(state, LAB_GUARD_CONFIG, { timeMs: t, deltaMs: 50, playerPosition: player, newSound });
    expect(result.violations).toEqual([]);
    if (result.record.kind === "transition") {
      transitions.push(`${result.record.rule}@${t}`);
    }
    state = result.state;
  }
  return { state, transitions };
}

describe("upgrade 7: distraction through the real guard controller", () => {
  it("U7-AC2: the guard investigates the distraction cell, not the player", () => {
    // Player hidden north of the wall; the noise lands next to the guard (27,17).
    const hidden = center({ x: 22, y: 13 });
    const thrown = throwDistraction({
      player: center({ x: 22, y: 16 }),
      target: center({ x: 25, y: 17 }),
      map: LAB_MAP,
      tileSize: TILE_SIZE,
      nowMs: 100,
      lastThrowMs: null,
    });
    expect(thrown.accepted).toBe(true);
    if (!thrown.accepted) return;

    const { state, transitions } = simulate(thrown.sound, hidden);
    console.info(`[U7] transiciones ${transitions.join(", ")} | memoria ${state.perception.memory.source}`);
    expect(transitions[0]).toBe("T5@100");
    expect(state.perception.memory.source).toBe("sound");
    expect(worldToCell(state.perception.memory.lastKnownPosition!, TILE_SIZE)).toEqual({ x: 25, y: 17 });
    expect(state.route.goal ?? worldToCell(state.position, TILE_SIZE)).toEqual({ x: 25, y: 17 });
  });

  it("U7-AC3: a distraction outside the guard's hearing radius causes no transition", () => {
    const far = throwDistraction({
      player: center({ x: 2, y: 2 }),
      target: center({ x: 5, y: 2 }),
      map: LAB_MAP,
      tileSize: TILE_SIZE,
      nowMs: 100,
      lastThrowMs: null,
    });
    expect(far.accepted).toBe(true);
    if (!far.accepted) return;

    const { transitions } = simulate(far.sound, center({ x: 2, y: 2 }));
    expect(transitions).toEqual([]);
  });
});

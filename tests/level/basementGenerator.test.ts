import { describe, expect, it } from "vitest";
import {
  fallbackBasement,
  generateBasement,
  hasAlternativePath,
  LEVEL_1_PARAMS,
  validateBasement,
} from "../../src/domain/level/basementGenerator";
import { cellKey, createGridMap, isWalkable } from "../../src/domain/model/grid";
import { findPathBfs } from "../../src/domain/navigation/search";

// specs/tp-01-generador-sotano.md and tp-02-patrulla-adaptada.md
// Heavy multi-seed tests get 20 s: in the full parallel run they exceeded the 5 s default.
const HEAVY = { timeout: 20_000 };
const SEEDS = Array.from({ length: 200 }, (_, index) => index * 7919 + 1);

describe("TP-01 basement generator", () => {
  it("200 seeds produce valid, playable basements within the ranges", HEAVY, () => {
    let fallbacks = 0;
    let maxAttempts = 0;
    for (const seed of SEEDS) {
      const basement = generateBasement(seed);
      expect(validateBasement(basement, LEVEL_1_PARAMS), `seed ${seed}`).toEqual([]);
      expect(basement.glass.length).toBeGreaterThanOrEqual(15);
      expect(basement.glass.length).toBeLessThanOrEqual(25);
      expect(basement.crates.length).toBeGreaterThanOrEqual(4);
      expect(basement.crates.length).toBeLessThanOrEqual(8);
      expect(basement.crates.every((crate) => !isWalkable(basement.map, crate))).toBe(true);
      // Border walls.
      for (let x = 0; x < 30; x += 1) {
        expect(isWalkable(basement.map, { x, y: 0 })).toBe(false);
        expect(isWalkable(basement.map, { x, y: 19 })).toBe(false);
      }
      if (basement.usedFallback) fallbacks += 1;
      maxAttempts = Math.max(maxAttempts, basement.attempts);
    }
    console.info(`[TP-01] 200 semillas: respaldos ${fallbacks}, intentos maximos ${maxAttempts}`);
    expect(fallbacks).toBe(0);
  });

  it("revision 2026-11-10: maze-like, with at least two different paths to the knife and loops", HEAVY, () => {
    for (const seed of SEEDS) {
      const basement = generateBasement(seed);
      expect(hasAlternativePath(basement.map, basement.playerStart, basement.knife), `seed ${seed}`).toBe(true);
      // Junctions (3+ open neighbours) outside the chambers show the maze is not just room-to-room corridors.
      const inChamber = (x: number, y: number) =>
        basement.rooms.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
      let junctions = 0;
      for (let y = 1; y < 19; y += 1) {
        for (let x = 1; x < 29; x += 1) {
          if (!isWalkable(basement.map, { x, y }) || inChamber(x, y)) continue;
          const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isWalkable(basement.map, { x: x + dx!, y: y + dy! })).length;
          if (open >= 3) junctions += 1;
        }
      }
      expect(junctions, `seed ${seed}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("revision 2: corridorWidth 1 (previous version) is still valid, so it can be restored", HEAVY, () => {
    const narrow = { ...LEVEL_1_PARAMS, corridorWidth: 1 as const };
    for (const seed of SEEDS.slice(0, 100)) {
      expect(validateBasement(generateBasement(seed, narrow), narrow), `seed ${seed}`).toEqual([]);
    }
  });

  it("a map with a single corridor is detected as having only one path", () => {
    const corridor = createGridMap(5, 3, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(hasAlternativePath(corridor, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false);
    expect(hasAlternativePath(createGridMap(5, 3, []), { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true);
  });

  it("is reproducible: same seed, same basement; different seeds, different basements", () => {
    const a = generateBasement(42);
    const b = generateBasement(42);
    const c = generateBasement(43);
    expect(b).toEqual(a);
    const layout = (x: typeof a) => [...x.map.blocked].sort().join("|");
    expect(layout(c)).not.toBe(layout(a));
  });

  it("generated basements differ in obstacles, so routes change between seeds", () => {
    const layouts = new Set(SEEDS.slice(0, 20).map((seed) => [...generateBasement(seed).map.blocked].sort().join("|")));
    expect(layouts.size).toBe(20);
  });

  it("problematic case: impossible parameters fall back to the fixed basement without blocking", () => {
    const impossible = { ...LEVEL_1_PARAMS, glass: [500, 600] as const, maxAttempts: 5 };
    const basement = generateBasement(7, impossible);
    expect(basement.usedFallback).toBe(true);
    expect(basement.attempts).toBe(5);
    expect(validateBasement(fallbackBasement(), { ...LEVEL_1_PARAMS, glass: [0, 100] })).toEqual([]);
  });
});

describe("TP-02 patrol points adapted to each basement", () => {
  it("100 seeds: 3 or 4 walkable patrol points reachable from the guard, starting at its room", HEAVY, () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const basement = generateBasement(seed);
      expect(basement.patrolPoints.length).toBeGreaterThanOrEqual(3);
      expect(basement.patrolPoints.length).toBeLessThanOrEqual(4);
      expect(basement.patrolPoints[0]).toEqual(basement.guardStart);
      for (const point of basement.patrolPoints) {
        expect(isWalkable(basement.map, point)).toBe(true);
        expect(findPathBfs(basement.map, basement.guardStart, point).status).toBe("success");
      }
      expect(new Set(basement.patrolPoints.map(cellKey)).size).toBe(basement.patrolPoints.length);
    }
  });

  it("patrol points change with the basement", () => {
    const first = generateBasement(SEEDS[0]!).patrolPoints.map(cellKey).join(" ");
    const second = generateBasement(SEEDS[1]!).patrolPoints.map(cellKey).join(" ");
    expect(second).not.toBe(first);
  });
});

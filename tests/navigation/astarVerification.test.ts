import { describe, expect, it } from "vitest";
import {
  GUARD_START,
  LAB_MAP,
  PLAYER_START,
} from "../../src/application/simulation/labLevel";
import { createGridMap, isWalkable, type GridMap, type GridPoint } from "../../src/domain/model/grid";
import { findPathAStar, findPathBfs, type SearchResult } from "../../src/domain/navigation/search";

// Lab spec AC1: complementary A* checks that the original suite did not cover.

const OPEN_5X3 = createGridMap(5, 3, []);
const DETOUR_5X3 = createGridMap(5, 3, [{ x: 2, y: 1 }]);
const S: GridPoint = { x: 0, y: 1 };
const G: GridPoint = { x: 4, y: 1 };

function expectValidCardinalRoute(map: GridMap, result: SearchResult): void {
  expect(result.status).toBe("success");
  expect(result.path.every((point) => isWalkable(map, point))).toBe(true);
  for (let index = 1; index < result.path.length; index += 1) {
    const previous = result.path[index - 1]!;
    const current = result.path[index]!;
    expect(Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)).toBe(1);
  }
  expect(result.totalCost).toBe(result.path.length - 1);
}

describe("A* verification", () => {
  it("returns the straight 4-step route on the open 5x3 fixture", () => {
    const result = findPathAStar(OPEN_5X3, S, G);

    expectValidCardinalRoute(OPEN_5X3, result);
    expect(result.path).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ]);
    expect(result.totalCost).toBe(4);
  });

  it("avoids a blocked cell with a 6-step detour and a reproducible tie-break", () => {
    const first = findPathAStar(DETOUR_5X3, S, G);
    const second = findPathAStar(DETOUR_5X3, S, G);

    expectValidCardinalRoute(DETOUR_5X3, first);
    expect(first.totalCost).toBe(6);
    expect(first.path).not.toContainEqual({ x: 2, y: 1 });
    // Same input must give the same route, exploration order and metrics.
    expect(second).toEqual(first);
    // Upper and lower detours tie on cost; the documented tie-break
    // (lower f, then lower h, then earlier insertion with neighbours
    // ordered up, right, down, left) selects the upper one.
    expect(first.path).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
    ]);
  });

  it("rejects endpoints outside the map in separate cases", () => {
    expect(findPathAStar(OPEN_5X3, { x: -1, y: 1 }, G).status).toBe("invalid-start");
    expect(findPathAStar(OPEN_5X3, S, { x: 5, y: 1 }).status).toBe("invalid-goal");
  });

  it("reports a full barrier as unreachable, distinct from invalid endpoints", () => {
    const barrier = createGridMap(5, 3, [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
    const result = findPathAStar(barrier, S, G);

    expect(result.status).toBe("unreachable");
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBeNull();
  });

  it("matches BFS cost on the lab map and records both metrics", () => {
    const pairs: ReadonlyArray<readonly [GridPoint, GridPoint]> = [
      [GUARD_START, PLAYER_START],
      [GUARD_START, { x: 12, y: 12 }],
      [{ x: 12, y: 12 }, { x: 27, y: 5 }],
    ];

    for (const [start, goal] of pairs) {
      const bfs = findPathBfs(LAB_MAP, start, goal);
      const astar = findPathAStar(LAB_MAP, start, goal);

      expectValidCardinalRoute(LAB_MAP, bfs);
      expectValidCardinalRoute(LAB_MAP, astar);
      expect(astar.totalCost).toBe(bfs.totalCost);
      console.info(
        `[comparacion] ${start.x},${start.y} -> ${goal.x},${goal.y} | `
        + `BFS costo ${bfs.totalCost} expandidos ${bfs.expandedNodes} frontera ${bfs.maximumFrontier} | `
        + `A* costo ${astar.totalCost} expandidos ${astar.expandedNodes} frontera ${astar.maximumFrontier}`,
      );
    }
  });
});

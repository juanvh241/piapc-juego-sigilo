import { describe, expect, it } from "vitest";
import { guardConfigFor, GLASS_COST } from "../../src/application/simulation/basementGuard";
import {
  initialGuardController,
  updateGuard,
  withAlgorithm,
  withNavigation,
  type GuardControllerConfig,
} from "../../src/application/simulation/guardController";
import { LAB_GUARD_CONFIG } from "../../src/application/simulation/labGuard";
import { calculateRoute, ignoresCosts } from "../../src/application/simulation/navigationDemo";
import { generateBasement } from "../../src/domain/level/basementGenerator";
import { cellCenter, createGridMap, type GridPoint } from "../../src/domain/model/grid";
import { findPathAStar, findPathBfs, findPathDijkstra, routeCost } from "../../src/domain/navigation/search";

// specs/tp-03-busqueda-y-navegacion.md
const MAP = createGridMap(5, 3, []);
const S: GridPoint = { x: 0, y: 1 };
const G: GridPoint = { x: 4, y: 1 };
const GLASS = new Map([["1,1", GLASS_COST], ["2,1", GLASS_COST], ["3,1", GLASS_COST]]);
const onGlass = (path: readonly GridPoint[]) => path.some((p) => GLASS.has(`${p.x},${p.y}`));

describe("TP-03 search algorithms with glass costs", () => {
  it("Dijkstra and A* find the same minimum (the detour); Dijkstra expands at least as many nodes", () => {
    const dijkstra = findPathDijkstra(MAP, S, G, { entryCosts: GLASS });
    const astar = findPathAStar(MAP, S, G, { entryCosts: GLASS });

    console.info(`[TP-03] dijkstra costo ${dijkstra.totalCost} expandidos ${dijkstra.expandedNodes} | astar costo ${astar.totalCost} expandidos ${astar.expandedNodes}`);
    expect(dijkstra.algorithm).toBe("dijkstra");
    expect(dijkstra.totalCost).toBe(6);
    expect(astar.totalCost).toBe(6);
    expect(onGlass(dijkstra.path)).toBe(false);
    expect(onGlass(astar.path)).toBe(false);
    expect(dijkstra.expandedNodes).toBeGreaterThanOrEqual(astar.expandedNodes);
  });

  it("BFS returns the fewest-steps route through the glass (it ignores costs)", () => {
    const bfs = findPathBfs(MAP, S, G);
    expect(bfs.path).toHaveLength(5);
    expect(onGlass(bfs.path)).toBe(true);
    expect(routeCost(bfs.path, GLASS)).toBe(16);
    expect(ignoresCosts("bfs")).toBe(true);
    expect(ignoresCosts("dijkstra")).toBe(false);
  });

  it("the consumer calculateRoute accepts 'dijkstra' and the glass costs", () => {
    const viaConsumer = calculateRoute(MAP, S, G, "dijkstra", { entryCosts: GLASS });
    expect(viaConsumer).toEqual(findPathDijkstra(MAP, S, G, { entryCosts: GLASS }));
    // Without costs Dijkstra behaves as a unit-cost search.
    expect(calculateRoute(MAP, S, G, "dijkstra").totalCost).toBe(4);
  });
});

describe("TP-03 navigation alternatives in the guard controller", () => {
  const config: GuardControllerConfig = {
    ...LAB_GUARD_CONFIG,
    map: MAP,
    guardStart: S,
    patrolPoints: [G, S],
    patrolPauseMs: 0,
    cautiousCosts: GLASS,
  };
  const far = { x: 10_000, y: 10_000 };

  function firstRoute(navigation: "direct" | "cautious", algorithm: "bfs" | "dijkstra" | "astar") {
    let state = withNavigation(withAlgorithm(initialGuardController(config), algorithm), navigation);
    state = updateGuard(state, config, { timeMs: 0, deltaMs: 0, playerPosition: far, newSound: null }).state;
    return state.route.result!;
  }

  it.each(["dijkstra", "astar"] as const)("%s: cautious avoids the glass, direct crosses it", (algorithm) => {
    const cautious = firstRoute("cautious", algorithm);
    const direct = firstRoute("direct", algorithm);
    expect(onGlass(cautious.path)).toBe(false);
    expect(cautious.totalCost).toBe(6);
    expect(onGlass(direct.path)).toBe(true);
    expect(direct.totalCost).toBe(4);
  });

  it("BFS with cautious navigation still uses the fewest steps", () => {
    expect(onGlass(firstRoute("cautious", "bfs").path)).toBe(true);
  });

  it("changing the navigation forces a new search on the next update", () => {
    let state = initialGuardController(config);
    state = updateGuard(state, config, { timeMs: 0, deltaMs: 0, playerPosition: far, newSound: null }).state;
    const searches = state.route.searches;
    state = withNavigation(state, "cautious");
    state = updateGuard(state, config, { timeMs: 50, deltaMs: 0, playerPosition: far, newSound: null }).state;
    expect(state.route.searches).toBe(searches + 1);
  });
});

describe("TP-02/TP-03 guard config for generated basements", () => {
  it("uses the basement map, patrol points and glass costs", () => {
    const basement = generateBasement(1234);
    const cfg = guardConfigFor(basement);
    expect(cfg.map).toBe(basement.map);
    expect(cfg.patrolPoints).toEqual(basement.patrolPoints);
    expect(cfg.cautiousCosts?.size).toBe(basement.glass.length);

    // The guard patrols the generated basement without invariant violations.
    let state = initialGuardController(cfg);
    for (let t = 0; t <= 20_000; t += 50) {
      const result = updateGuard(state, cfg, {
        timeMs: t,
        deltaMs: 50,
        playerPosition: cellCenter({ x: 0, y: 0 }, 32),
        newSound: null,
      });
      expect(result.violations).toEqual([]);
      state = result.state;
    }
  });
});

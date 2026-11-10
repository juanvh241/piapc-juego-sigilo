import { describe, expect, it } from "vitest";
import { calculateRoute } from "../../src/application/simulation/navigationDemo";
import { createGridMap, isWalkable, type GridMap, type GridPoint } from "../../src/domain/model/grid";
import {
  findPathAStar,
  findPathBfs,
  routeCost,
  type EntryCosts,
  type SearchResult,
} from "../../src/domain/navigation/search";

// Práctica guiada de navegación — spec en docs/practica-navegacion/spec.md.

const FIXTURE = createGridMap(5, 3, []);
const BARRIER = createGridMap(5, 3, [
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 2, y: 2 },
]);
const S: GridPoint = { x: 0, y: 1 };
const G: GridPoint = { x: 4, y: 1 };

function expectCardinalRoute(map: GridMap, result: SearchResult): void {
  expect(result.status).toBe("success");
  expect(result.path[0]).toEqual(S);
  expect(result.path.at(-1)).toEqual(G);
  expect(result.path.every((point) => isWalkable(map, point))).toBe(true);
  for (let index = 1; index < result.path.length; index += 1) {
    const a = result.path[index - 1]!;
    const b = result.path[index]!;
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
  }
}

function describeResult(result: SearchResult): string {
  const route = result.path.map((p) => `(${p.x},${p.y})`).join(" ");
  return `${result.algorithm} | ${result.status} | ${route || "-"} | pasos ${Math.max(0, result.path.length - 1)}`
    + ` | costo ${result.totalCost ?? "-"} | expandidos ${result.expandedNodes} | frontera ${result.maximumFrontier}`;
}

describe("BASE-02 / BASE-AC2: BFS y A* unitarios en el fixture libre 5x3", () => {
  it.each([
    ["BFS", findPathBfs],
    ["A*", findPathAStar],
  ] as const)("%s devuelve ruta cardinal válida de 4 pasos y costo 4", (_name, findPath) => {
    const result = findPath(FIXTURE, S, G);

    console.info(`[BASE-02] ${describeResult(result)}`);
    expectCardinalRoute(FIXTURE, result);
    expect(result.path).toHaveLength(5);
    expect(result.totalCost).toBe(4);
  });
});

describe("BASE-04 / BASE-AC3: casos comunes con el contrato real", () => {
  it.each([
    ["BFS", findPathBfs],
    ["A*", findPathAStar],
  ] as const)("%s: inicio=meta, barrera, extremos inválidos", (name, findPath) => {
    const same = findPath(FIXTURE, S, S);
    expect(same.status).toBe("success");
    expect(same.path).toEqual([S]);
    expect(same.totalCost).toBe(0);

    const blocked = findPath(BARRIER, S, G);
    expect(blocked.status).toBe("unreachable");
    expect(blocked.path).toEqual([]);
    expect(blocked.totalCost).toBeNull();

    const badStart = findPath(FIXTURE, { x: -1, y: 1 }, G);
    const badGoal = findPath(FIXTURE, S, { x: 5, y: 1 });
    expect(badStart.status).toBe("invalid-start");
    expect(badGoal.status).toBe("invalid-goal");
    expect(badStart.expandedNodes).toBe(0);
    expect(badGoal.expandedNodes).toBe(0);

    console.info(
      `[BASE-04] ${name} | inicio=meta ${same.status} costo ${same.totalCost}`
      + ` | barrera ${blocked.status} expandidos ${blocked.expandedNodes}`
      + ` | inicio (-1,1) ${badStart.status} | meta (5,1) ${badGoal.status}`,
    );
  });
});

// Anexo A: terreno lento. Franja de costo de entrada 5 en (1,1), (2,1), (3,1).
const SLOW_STRIP: EntryCosts = new Map([
  ["1,1", 5],
  ["2,1", 5],
  ["3,1", 5],
]);
const RESTORED_STRIP: EntryCosts = new Map([
  ["1,1", 1],
  ["2,1", 1],
  ["3,1", 1],
]);
const DIRECT_ROUTE: readonly GridPoint[] = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
];
const STRIP_CELLS = [...SLOW_STRIP.keys()];

describe("Anexo A — incremento 1: A* ponderado en el dominio", () => {
  it("A-AC1: ruta directa 4 pasos/costo 16; A* ponderado elige un rodeo de 6 pasos y costo 6", () => {
    expect(DIRECT_ROUTE).toHaveLength(5);
    expect(routeCost(DIRECT_ROUTE, SLOW_STRIP)).toBe(16);

    const result = findPathAStar(FIXTURE, S, G, { entryCosts: SLOW_STRIP });
    console.info(`[A-AC1] ponderado ${describeResult(result)}`);
    expectCardinalRoute(FIXTURE, result);
    expect(result.path.length - 1).toBe(6);
    expect(result.totalCost).toBe(6);
    expect(routeCost(result.path, SLOW_STRIP)).toBe(6);
    // Upper or lower detour are both valid: only the strip must be avoided.
    expect(result.path.some((p) => STRIP_CELLS.includes(`${p.x},${p.y}`))).toBe(false);
  });

  it("A-01: BFS conserva la semántica unitaria y no es oráculo del mínimo ponderado", () => {
    const bfs = findPathBfs(FIXTURE, S, G);
    expect(bfs.path).toEqual(DIRECT_ROUTE);
    expect(bfs.totalCost).toBe(4);
    // Its unit route actually costs 16 with the strip: BFS cannot be the weighted reference.
    expect(routeCost(bfs.path, SLOW_STRIP)).toBe(16);
  });

  it("A-AC2: sin franja lenta, 4 pasos y costo 4", () => {
    const withoutOption = findPathAStar(FIXTURE, S, G);
    const emptyCosts = findPathAStar(FIXTURE, S, G, { entryCosts: new Map() });

    for (const result of [withoutOption, emptyCosts]) {
      expectCardinalRoute(FIXTURE, result);
      expect(result.path).toEqual(DIRECT_ROUTE);
      expect(result.totalCost).toBe(4);
    }
  });

  it("A-04: al restaurar la franja a costo 1 se usan los datos nuevos", () => {
    const slow = findPathAStar(FIXTURE, S, G, { entryCosts: SLOW_STRIP });
    const restored = findPathAStar(FIXTURE, S, G, { entryCosts: RESTORED_STRIP });

    expect(slow.totalCost).toBe(6);
    expect(restored.path).toEqual(DIRECT_ROUTE);
    expect(restored.totalCost).toBe(4);
  });

  it("A-02: rechaza costos que romperían la heurística Manhattan (menores a 1 o no finitos)", () => {
    expect(() => findPathAStar(FIXTURE, S, G, { entryCosts: new Map([["2,1", 0.5]]) })).toThrow();
    expect(() => findPathAStar(FIXTURE, S, G, { entryCosts: new Map([["2,1", Number.NaN]]) })).toThrow();
  });
});

describe("Anexo A — incremento 2: consumidor existente calculateRoute", () => {
  it("A-AC3: el consumidor usa el modo ponderado y obtiene costo 6 con franja", () => {
    const weighted = calculateRoute(FIXTURE, S, G, "astar", { entryCosts: SLOW_STRIP });

    console.info(`[A-AC3] consumidor ponderado ${describeResult(weighted)}`);
    expectCardinalRoute(FIXTURE, weighted);
    expect(weighted.totalCost).toBe(6);
    expect(weighted.path.some((p) => STRIP_CELLS.includes(`${p.x},${p.y}`))).toBe(false);
  });

  it("A-AC3: el modo unitario existente del consumidor conserva su funcionamiento", () => {
    const unitAStar = calculateRoute(FIXTURE, S, G, "astar");
    const unitBfs = calculateRoute(FIXTURE, S, G, "bfs");
    const bfsIgnoresCosts = calculateRoute(FIXTURE, S, G, "bfs", { entryCosts: SLOW_STRIP });

    expect(unitAStar).toEqual(findPathAStar(FIXTURE, S, G));
    expect(unitBfs).toEqual(findPathBfs(FIXTURE, S, G));
    expect(unitAStar.totalCost).toBe(4);
    expect(bfsIgnoresCosts).toEqual(unitBfs);
  });
});

import { cellKey, isWalkable, type GridMap, type GridPoint } from "../model/grid";
import { manhattanDistance, walkableNeighbors } from "./gridGraph";

export type SearchAlgorithm = "bfs" | "dijkstra" | "astar";
export type SearchStatus = "success" | "unreachable" | "invalid-start" | "invalid-goal";

export interface SearchResult {
  readonly algorithm: SearchAlgorithm;
  readonly status: SearchStatus;
  readonly path: readonly GridPoint[];
  readonly totalCost: number | null;
  readonly expandedNodes: number;
  readonly maximumFrontier: number;
  readonly explored: readonly GridPoint[];
}

/**
 * Optional cost of ENTERING each cell, keyed by `cellKey`. Missing cells cost 1.
 * Costs must be finite and >= 1 so that the Manhattan heuristic stays admissible.
 */
export type EntryCosts = ReadonlyMap<string, number>;

export interface AStarOptions {
  readonly entryCosts?: EntryCosts;
}

interface AStarNode {
  readonly point: GridPoint;
  readonly cost: number;
  readonly heuristic: number;
  readonly order: number;
}

export function findPathBfs(map: GridMap, start: GridPoint, goal: GridPoint): SearchResult {
  const invalid = validateEndpoints("bfs", map, start, goal);
  if (invalid) {
    return invalid;
  }

  const frontier: GridPoint[] = [start];
  let frontierIndex = 0;
  let maximumFrontier = 1;
  const visited = new Set([cellKey(start)]);
  const parents = new Map<string, GridPoint>();
  const explored: GridPoint[] = [];

  while (frontierIndex < frontier.length) {
    const current = frontier[frontierIndex];
    if (!current) {
      throw new Error("BFS frontier invariant failed.");
    }
    frontierIndex += 1;
    explored.push(current);

    if (samePoint(current, goal)) {
      // BFS keeps its unit semantics: cost = number of steps, never a weighted minimum.
      return successResult("bfs", start, goal, parents, explored, maximumFrontier, null);
    }

    for (const neighbor of walkableNeighbors(map, current)) {
      const key = cellKey(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        parents.set(key, current);
        frontier.push(neighbor);
      }
    }

    maximumFrontier = Math.max(maximumFrontier, frontier.length - frontierIndex);
  }

  return failureResult("bfs", "unreachable", explored, maximumFrontier);
}

export function findPathAStar(
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
  options: AStarOptions = {},
): SearchResult {
  return bestFirstSearch("astar", map, start, goal, options);
}

/**
 * Dijkstra (TP-03): the same best-first search with heuristic 0, so it reuses the
 * A* code instead of duplicating it. Supports the same entry costs.
 */
export function findPathDijkstra(
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
  options: AStarOptions = {},
): SearchResult {
  return bestFirstSearch("dijkstra", map, start, goal, options);
}

function bestFirstSearch(
  algorithm: "astar" | "dijkstra",
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
  options: AStarOptions,
): SearchResult {
  const heuristicTo = (point: GridPoint) => (algorithm === "astar" ? manhattanDistance(point, goal) : 0);
  const entryCosts = options.entryCosts;
  validateEntryCosts(entryCosts);
  const invalid = validateEndpoints(algorithm, map, start, goal);
  if (invalid) {
    return invalid;
  }

  let insertionOrder = 0;
  const startKey = cellKey(start);
  const frontier = new Map<string, AStarNode>([
    [
      startKey,
      { point: start, cost: 0, heuristic: heuristicTo(start), order: insertionOrder },
    ],
  ]);
  const bestCosts = new Map<string, number>([[startKey, 0]]);
  const parents = new Map<string, GridPoint>();
  const explored: GridPoint[] = [];
  const closed = new Set<string>();
  let maximumFrontier = 1;

  while (frontier.size > 0) {
    const current = lowestPriorityNode(frontier);
    const currentKey = cellKey(current.point);
    frontier.delete(currentKey);
    closed.add(currentKey);
    explored.push(current.point);

    if (samePoint(current.point, goal)) {
      // g of the goal is the sum of entry costs along the route, not the step count.
      return successResult(algorithm, start, goal, parents, explored, maximumFrontier, current.cost);
    }

    for (const neighbor of walkableNeighbors(map, current.point)) {
      const neighborKey = cellKey(neighbor);
      if (closed.has(neighborKey)) {
        continue;
      }

      const candidateCost = current.cost + entryCost(entryCosts, neighbor);
      const knownCost = bestCosts.get(neighborKey);
      if (knownCost === undefined || candidateCost < knownCost) {
        insertionOrder += 1;
        bestCosts.set(neighborKey, candidateCost);
        parents.set(neighborKey, current.point);
        frontier.set(neighborKey, {
          point: neighbor,
          cost: candidateCost,
          heuristic: heuristicTo(neighbor),
          order: insertionOrder,
        });
      }
    }

    maximumFrontier = Math.max(maximumFrontier, frontier.size);
  }

  return failureResult(algorithm, "unreachable", explored, maximumFrontier);
}

function validateEndpoints(
  algorithm: SearchAlgorithm,
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
): SearchResult | null {
  if (!isWalkable(map, start)) {
    return failureResult(algorithm, "invalid-start", [], 0);
  }
  if (!isWalkable(map, goal)) {
    return failureResult(algorithm, "invalid-goal", [], 0);
  }
  return null;
}

function lowestPriorityNode(frontier: ReadonlyMap<string, AStarNode>): AStarNode {
  let selected: AStarNode | undefined;

  for (const candidate of frontier.values()) {
    const candidateScore = candidate.cost + candidate.heuristic;
    const selectedScore = selected ? selected.cost + selected.heuristic : Number.POSITIVE_INFINITY;
    if (
      !selected
      || candidateScore < selectedScore
      || (candidateScore === selectedScore && candidate.heuristic < selected.heuristic)
      || (
        candidateScore === selectedScore
        && candidate.heuristic === selected.heuristic
        && candidate.order < selected.order
      )
    ) {
      selected = candidate;
    }
  }

  if (!selected) {
    throw new Error("A* frontier invariant failed.");
  }
  return selected;
}

function successResult(
  algorithm: SearchAlgorithm,
  start: GridPoint,
  goal: GridPoint,
  parents: ReadonlyMap<string, GridPoint>,
  explored: readonly GridPoint[],
  maximumFrontier: number,
  weightedCost: number | null,
): SearchResult {
  const path = reconstructPath(start, goal, parents);
  return {
    algorithm,
    status: "success",
    path,
    totalCost: weightedCost ?? path.length - 1,
    expandedNodes: explored.length,
    maximumFrontier,
    explored,
  };
}

function failureResult(
  algorithm: SearchAlgorithm,
  status: Exclude<SearchStatus, "success">,
  explored: readonly GridPoint[],
  maximumFrontier: number,
): SearchResult {
  return {
    algorithm,
    status,
    path: [],
    totalCost: null,
    expandedNodes: explored.length,
    maximumFrontier,
    explored,
  };
}

function reconstructPath(
  start: GridPoint,
  goal: GridPoint,
  parents: ReadonlyMap<string, GridPoint>,
): GridPoint[] {
  const path: GridPoint[] = [goal];
  let current = goal;

  while (!samePoint(current, start)) {
    const parent = parents.get(cellKey(current));
    if (!parent) {
      throw new Error("Path reconstruction invariant failed.");
    }
    path.push(parent);
    current = parent;
  }

  return path.reverse();
}

/** Cost of a given route: sum of entry costs, the start cell does not add cost. */
export function routeCost(path: readonly GridPoint[], entryCosts?: EntryCosts): number {
  validateEntryCosts(entryCosts);
  return path.slice(1).reduce((total, point) => total + entryCost(entryCosts, point), 0);
}

function entryCost(entryCosts: EntryCosts | undefined, point: GridPoint): number {
  return entryCosts?.get(cellKey(point)) ?? 1;
}

function validateEntryCosts(entryCosts: EntryCosts | undefined): void {
  if (!entryCosts) {
    return;
  }
  for (const [key, cost] of entryCosts) {
    if (!Number.isFinite(cost) || cost < 1) {
      throw new Error(`Entry cost for ${key} must be finite and at least 1.`);
    }
  }
}

function samePoint(left: GridPoint, right: GridPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

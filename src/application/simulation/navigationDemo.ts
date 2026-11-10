import type { GridMap, GridPoint } from "../../domain/model/grid";
import {
  findPathAStar,
  findPathBfs,
  findPathDijkstra,
  type EntryCosts,
  type SearchAlgorithm,
  type SearchResult,
} from "../../domain/navigation/search";

export interface RouteOptions {
  /**
   * Weighted mode (práctica de navegación, anexo A; TP-03 ruta cautelosa): cost of
   * entering each cell. A* and Dijkstra use it; BFS keeps its unit semantics and ignores it.
   */
  readonly entryCosts?: EntryCosts;
}

export function calculateRoute(
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
  algorithm: SearchAlgorithm,
  options: RouteOptions = {},
): SearchResult {
  switch (algorithm) {
    case "astar":
      return findPathAStar(map, start, goal, { entryCosts: options.entryCosts });
    case "dijkstra":
      return findPathDijkstra(map, start, goal, { entryCosts: options.entryCosts });
    case "bfs":
      return findPathBfs(map, start, goal);
  }
}

/** True when the selected algorithm cannot honour cell costs (shown as a HUD warning). */
export function ignoresCosts(algorithm: SearchAlgorithm): boolean {
  return algorithm === "bfs";
}

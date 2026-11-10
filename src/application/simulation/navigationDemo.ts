import type { GridMap, GridPoint } from "../../domain/model/grid";
import {
  findPathAStar,
  findPathBfs,
  type EntryCosts,
  type SearchAlgorithm,
  type SearchResult,
} from "../../domain/navigation/search";

export interface RouteOptions {
  /**
   * Weighted mode (práctica de navegación, anexo A): cost of entering each cell.
   * Only A* uses it; BFS keeps its unit semantics and ignores it.
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
  return algorithm === "astar"
    ? findPathAStar(map, start, goal, { entryCosts: options.entryCosts })
    : findPathBfs(map, start, goal);
}

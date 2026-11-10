import { cellKey, createGridMap, isWalkable, type GridMap, type GridPoint } from "../model/grid";
import { mulberry32, pick, randomInt, shuffled, type Random } from "../model/random";
import { findPathBfs } from "../navigation/search";

/**
 * Basement generator — specs/tp-01-generador-sotano.md and tp-02-patrulla-adaptada.md.
 * Pure domain code: no Phaser, randomness injected through the seed.
 */

export interface Room {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly center: GridPoint;
}

export interface BasementParams {
  readonly width: number;
  readonly height: number;
  readonly crates: readonly [number, number];
  readonly glass: readonly [number, number];
  readonly minGuardDistance: number;
  readonly maxAttempts: number;
  /** Corridor width of the maze in cells (revision 2, 2026-11-10: 2; previous version: 1). */
  readonly corridorWidth: 1 | 2;
}

export interface Basement {
  readonly seed: number;
  readonly attempts: number;
  readonly usedFallback: boolean;
  readonly map: GridMap;
  readonly rooms: readonly Room[];
  readonly crates: readonly GridPoint[];
  readonly glass: readonly GridPoint[];
  readonly glassKeys: ReadonlySet<string>;
  readonly knife: GridPoint;
  readonly exit: GridPoint;
  readonly playerStart: GridPoint;
  readonly guardStart: GridPoint;
  readonly patrolPoints: readonly GridPoint[];
}

export const LEVEL_1_PARAMS: BasementParams = {
  width: 30,
  height: 20,
  crates: [4, 8],
  glass: [15, 25],
  minGuardDistance: 12,
  maxAttempts: 50,
  corridorWidth: 2,
};

const SECTOR_COLUMNS = 3;
const SECTOR_ROWS = 2;
const SHORTCUT_PROBABILITY = 0.18;

export function generateBasement(seed: number, params: BasementParams = LEVEL_1_PARAMS): Basement {
  const random = mulberry32(seed);
  for (let attempt = 1; attempt <= params.maxAttempts; attempt += 1) {
    const candidate = tryLayout(random, params, seed, attempt);
    if (candidate && validateBasement(candidate, params).length === 0) {
      return candidate;
    }
  }
  return { ...fallbackBasement(), seed, attempts: params.maxAttempts, usedFallback: true };
}

/** Returns the list of broken rules; empty means the basement is valid and playable. */
export function validateBasement(basement: Basement, params: BasementParams): string[] {
  const problems: string[] = [];
  const { map } = basement;
  const named: Array<[string, GridPoint]> = [
    ["jugador", basement.playerStart],
    ["matón", basement.guardStart],
    ["cuchillo", basement.knife],
    ["puerta", basement.exit],
  ];
  for (const [name, point] of named) {
    if (!isWalkable(map, point)) {
      problems.push(`${name} sobre una celda bloqueada`);
    }
  }
  const unique = new Set(named.map(([, point]) => cellKey(point)));
  if (unique.size !== named.length) {
    problems.push("objetos superpuestos");
  }
  for (const glass of basement.glass) {
    if (!isWalkable(map, glass) || unique.has(cellKey(glass))) {
      problems.push("vidrio mal ubicado");
      break;
    }
  }
  if (basement.glass.length < params.glass[0] || basement.glass.length > params.glass[1]) {
    problems.push("cantidad de vidrios fuera de rango");
  }
  for (const [name, target] of named.slice(1)) {
    if (findPathBfs(map, basement.playerStart, target).status !== "success") {
      problems.push(`${name} inalcanzable desde el jugador`);
    }
  }
  if (!hasAlternativePath(map, basement.playerStart, basement.knife)) {
    problems.push("un solo camino hasta el cuchillo");
  }
  const guardDistance = findPathBfs(map, basement.playerStart, basement.guardStart).totalCost;
  if (guardDistance !== null && guardDistance < params.minGuardDistance) {
    problems.push("matón demasiado cerca del jugador");
  }
  if (basement.patrolPoints.length < 3 || basement.patrolPoints.length > 4) {
    problems.push("cantidad de puntos de patrulla fuera de rango");
  }
  for (const point of basement.patrolPoints) {
    if (findPathBfs(map, basement.guardStart, point).status !== "success") {
      problems.push("punto de patrulla inalcanzable");
      break;
    }
  }
  return problems;
}

function tryLayout(random: Random, params: BasementParams, seed: number, attempt: number): Basement | null {
  // Maze-like layout (revised after the 2026-11-10 playtest): random DFS maze,
  // 18 % of the inner walls removed to create loops, then 5-6 wider chambers.
  const open = new Set<string>();
  carveMaze(open, random, params);
  openShortcuts(open, random, params, SHORTCUT_PROBABILITY);
  const rooms = createChambers(random, params);
  for (const room of rooms) {
    carveRectangle(open, room.x, room.y, room.width, room.height);
  }

  // Crates: inner room cells, never on room centres (corridor anchors / patrol points).
  const centers = new Set(rooms.map((room) => cellKey(room.center)));
  const crateCandidates = rooms.flatMap((room) => innerCells(room)).filter((p) => !centers.has(cellKey(p)));
  const crates = shuffled(random, crateCandidates).slice(0, randomInt(random, params.crates[0], params.crates[1]));
  for (const crate of crates) {
    open.delete(cellKey(crate));
  }

  const map = mapFromOpen(params, open);
  const free = (room: Room) => roomCells(room).filter((p) => isWalkable(map, p));

  const roomIndexes = rooms.map((_, index) => index);
  const playerRoom = pick(random, roomIndexes);
  const playerFree = free(rooms[playerRoom]!).filter((p) => cellKey(p) !== cellKey(rooms[playerRoom]!.center));
  if (playerFree.length === 0) return null;
  const playerStart = pick(random, playerFree);

  // Guard in another room, far enough from the player (checked again by validation).
  const others = roomIndexes.filter((index) => index !== playerRoom);
  const guardRoom = pick(random, others);
  const guardStart = rooms[guardRoom]!.center;
  if (!isWalkable(map, guardStart)) return null;

  const knifeRoom = pick(random, others);
  const taken = new Set([cellKey(playerStart), cellKey(guardStart)]);
  const knifeCells = free(rooms[knifeRoom]!).filter((p) => !taken.has(cellKey(p)) && !centers.has(cellKey(p)));
  if (knifeCells.length === 0) return null;
  const knife = pick(random, knifeCells);
  taken.add(cellKey(knife));

  // Exit: free cell in the room whose centre is farthest from the player.
  const exitRoom = [...others].sort((a, b) =>
    pathLength(map, playerStart, rooms[b]!.center) - pathLength(map, playerStart, rooms[a]!.center))[0]!;
  const exitCells = free(rooms[exitRoom]!).filter((p) => !taken.has(cellKey(p)) && !centers.has(cellKey(p)));
  if (exitCells.length === 0) return null;
  const exit = pick(random, exitCells);
  taken.add(cellKey(exit));

  // Patrol (TP-02): guard room centre plus 2 or 3 other reachable room centres, avoiding the player room.
  const patrolRooms = shuffled(random, others.filter((index) => index !== guardRoom))
    .filter((index) => isWalkable(map, rooms[index]!.center));
  const patrolPoints = [guardStart, ...patrolRooms.slice(0, randomInt(random, 2, 3)).map((index) => rooms[index]!.center)];

  const glassCandidates = [...open]
    .map(parseKey)
    .filter((p) => !taken.has(cellKey(p)))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const glass = shuffled(random, glassCandidates).slice(0, randomInt(random, params.glass[0], params.glass[1]));

  return {
    seed,
    attempts: attempt,
    usedFallback: false,
    map,
    rooms,
    crates,
    glass,
    glassKeys: new Set(glass.map(cellKey)),
    knife,
    exit,
    playerStart,
    guardStart,
    patrolPoints,
  };
}

function createChambers(random: Random, params: BasementParams): Room[] {
  const innerWidth = params.width - 2;
  const innerHeight = params.height - 2;
  const rooms: Room[] = [];
  for (let row = 0; row < SECTOR_ROWS; row += 1) {
    for (let column = 0; column < SECTOR_COLUMNS; column += 1) {
      const sx0 = 1 + Math.floor((column * innerWidth) / SECTOR_COLUMNS);
      const sx1 = Math.floor(((column + 1) * innerWidth) / SECTOR_COLUMNS);
      const sy0 = 1 + Math.floor((row * innerHeight) / SECTOR_ROWS);
      const sy1 = Math.floor(((row + 1) * innerHeight) / SECTOR_ROWS);
      const sectorWidth = sx1 - sx0 + 1;
      const sectorHeight = sy1 - sy0 + 1;
      const width = randomInt(random, 4, Math.min(6, sectorWidth - 2));
      const height = randomInt(random, 3, Math.min(5, sectorHeight - 2));
      const x = randomInt(random, sx0 + 1, sx1 - width);
      const y = randomInt(random, sy0 + 1, sy1 - height);
      rooms.push({
        x,
        y,
        width,
        height,
        center: { x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) },
      });
    }
  }
  // 5 or 6 chambers: sometimes one sector stays pure maze.
  return random() < 0.5 ? rooms : shuffled(random, rooms).slice(0, rooms.length - 1);
}

/** Perfect maze over odd cells with a randomized depth-first search (iterative). */
function carveMaze(open: Set<string>, random: Random, params: BasementParams): void {
  // Maze cells are squares of corridorWidth cells separated by 1-cell walls.
  const w = params.corridorWidth;
  const step = w + 1;
  const maxX = params.width - 2;
  const maxY = params.height - 2;
  const fits = (p: GridPoint) => p.x >= 1 && p.y >= 1 && p.x + w - 1 <= maxX && p.y + w - 1 <= maxY;
  const start = { x: 1, y: 1 };
  const visited = new Set([cellKey(start)]);
  const stack: GridPoint[] = [start];
  carveRectangle(open, start.x, start.y, w, w);
  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    const options = [
      { x: current.x + step, y: current.y },
      { x: current.x - step, y: current.y },
      { x: current.x, y: current.y + step },
      { x: current.x, y: current.y - step },
    ].filter((next) => fits(next) && !visited.has(cellKey(next)));
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const next = pick(random, options);
    visited.add(cellKey(next));
    // Open the 1-cell wall between both maze cells, across the whole corridor width.
    if (next.x !== current.x) {
      carveRectangle(open, Math.min(current.x, next.x) + w, current.y, 1, w);
    } else {
      carveRectangle(open, current.x, Math.min(current.y, next.y) + w, w, 1);
    }
    carveRectangle(open, next.x, next.y, w, w);
    stack.push(next);
  }
}

/** Opens some walls that separate two maze corridors, creating loops (several paths). */
function openShortcuts(open: Set<string>, random: Random, params: BasementParams, probability: number): void {
  for (let y = 1; y <= params.height - 2; y += 1) {
    for (let x = 1; x <= params.width - 2; x += 1) {
      const key = cellKey({ x, y });
      if (open.has(key)) continue;
      const horizontal = open.has(cellKey({ x: x - 1, y })) && open.has(cellKey({ x: x + 1, y }));
      const vertical = open.has(cellKey({ x, y: y - 1 })) && open.has(cellKey({ x, y: y + 1 }));
      if ((horizontal || vertical) && random() < probability) {
        open.add(key);
      }
    }
  }
}

function carveLine(open: Set<string>, from: GridPoint, to: GridPoint): void {
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  let x = from.x;
  let y = from.y;
  open.add(cellKey({ x, y }));
  while (x !== to.x || y !== to.y) {
    x += stepX;
    y += stepY;
    open.add(cellKey({ x, y }));
  }
}

function carveRectangle(open: Set<string>, x0: number, y0: number, width: number, height: number): void {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      open.add(cellKey({ x, y }));
    }
  }
}

function roomCells(room: Room): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

function innerCells(room: Room): GridPoint[] {
  return roomCells(room).filter((p) =>
    p.x > room.x && p.x < room.x + room.width - 1 && p.y > room.y && p.y < room.y + room.height - 1);
}

function mapFromOpen(params: BasementParams, open: ReadonlySet<string>): GridMap {
  const blocked: GridPoint[] = [];
  for (let y = 0; y < params.height; y += 1) {
    for (let x = 0; x < params.width; x += 1) {
      const inside = x > 0 && y > 0 && x < params.width - 1 && y < params.height - 1;
      if (!inside || !open.has(cellKey({ x, y }))) {
        blocked.push({ x, y });
      }
    }
  }
  return createGridMap(params.width, params.height, blocked);
}

/**
 * True when the target stays reachable after blocking the intermediate cells of the
 * shortest route, i.e. there are at least two different paths (revision 2026-11-10).
 */
export function hasAlternativePath(map: GridMap, from: GridPoint, to: GridPoint): boolean {
  const first = findPathBfs(map, from, to);
  if (first.status !== "success" || first.path.length < 3) {
    return first.status === "success";
  }
  const blocked = new Set(map.blocked);
  for (const point of first.path.slice(1, -1)) {
    blocked.add(cellKey(point));
  }
  return findPathBfs({ ...map, blocked }, from, to).status === "success";
}

function pathLength(map: GridMap, from: GridPoint, to: GridPoint): number {
  return findPathBfs(map, from, to).totalCost ?? -1;
}

function parseKey(key: string): GridPoint {
  const [x, y] = key.split(",").map(Number);
  return { x: x!, y: y! };
}

/** Hand-made, always valid basement used if every attempt fails (shown in the HUD). */
export function fallbackBasement(): Basement {
  const params = LEVEL_1_PARAMS;
  const open = new Set<string>();
  const rooms: Room[] = [
    { x: 2, y: 2, width: 7, height: 6, center: { x: 5, y: 5 } },
    { x: 20, y: 2, width: 7, height: 6, center: { x: 23, y: 5 } },
    { x: 2, y: 12, width: 7, height: 6, center: { x: 5, y: 15 } },
    { x: 20, y: 12, width: 7, height: 6, center: { x: 23, y: 15 } },
  ];
  for (const room of rooms) carveRectangle(open, room.x, room.y, room.width, room.height);
  carveLine(open, { x: 5, y: 5 }, { x: 23, y: 5 });
  carveLine(open, { x: 5, y: 5 }, { x: 5, y: 15 });
  carveLine(open, { x: 23, y: 5 }, { x: 23, y: 15 });
  carveLine(open, { x: 5, y: 15 }, { x: 23, y: 15 });
  const map = mapFromOpen(params, open);
  const glass: GridPoint[] = [];
  for (let x = 10; x <= 18; x += 1) glass.push({ x, y: 5 }, { x, y: 15 });
  return {
    seed: 0,
    attempts: 0,
    usedFallback: true,
    map,
    rooms,
    crates: [],
    glass,
    glassKeys: new Set(glass.map(cellKey)),
    knife: { x: 3, y: 16 },
    exit: { x: 25, y: 16 },
    playerStart: { x: 3, y: 3 },
    guardStart: { x: 23, y: 5 },
    patrolPoints: [{ x: 23, y: 5 }, { x: 23, y: 15 }, { x: 5, y: 15 }],
  };
}

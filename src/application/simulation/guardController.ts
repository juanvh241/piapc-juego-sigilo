import {
  checkGuardInvariants,
  initialGuardBrain,
  selectGuardEvent,
  stepGuard,
  type GuardBrain,
  type GuardContext,
  type GuardEvent,
  type TransitionRecord,
} from "../../domain/behavior/guardFsm";
import {
  cellCenter,
  isWalkable,
  worldToCell,
  type GridMap,
  type GridPoint,
} from "../../domain/model/grid";
import type { Vector2 } from "../../domain/model/vector";
import { advanceAlongPath } from "../../domain/navigation/pathFollower";
import type { EntryCosts, SearchAlgorithm, SearchResult } from "../../domain/navigation/search";
import type { SoundEvent, VisionResult } from "../../domain/perception/perception";
import { calculateRoute } from "./navigationDemo";
import {
  initialPerceptionState,
  updatePerceptionSimulation,
  withSoundEvent,
  type PerceptionSimulationState,
} from "./perceptionSimulation";

/**
 * Coordinates perception, the guard FSM, A* and path following.
 * It decides when to search for a route; it never decides behaviour itself.
 */

export interface GuardControllerConfig {
  readonly map: GridMap;
  readonly tileSize: number;
  readonly guardStart: GridPoint;
  readonly patrolPoints: readonly GridPoint[];
  readonly guardSpeed: number;
  readonly visionRange: number;
  readonly fieldOfViewRadians: number;
  readonly searchDurationMs: number;
  readonly lookIntervalMs: number;
  readonly chaseReplanMs: number;
  readonly logLimit: number;
  /** Upgrade 1: pause at each patrol point (0 disables it). */
  readonly patrolPauseMs?: number;
  /** Upgrade 1: look-around amplitude during the pause, in radians. */
  readonly patrolLookRadians?: number;
  /** TP-03: entry costs used by the cautious navigation (glass cells cost more). */
  readonly cautiousCosts?: EntryCosts;
}

/** TP-03: direct = every cell costs 1; cautious = glass cells are expensive. */
export type NavigationMode = "direct" | "cautious";

export interface GuardRoute {
  readonly goal: GridPoint | null;
  readonly result: SearchResult | null;
  readonly waypoints: readonly Vector2[];
  readonly nextWaypoint: number;
  readonly plannedAtMs: number;
  readonly searches: number;
}

export interface GuardControllerState {
  readonly brain: GuardBrain;
  readonly perception: PerceptionSimulationState;
  readonly position: Vector2;
  readonly facing: Vector2;
  readonly algorithm: SearchAlgorithm;
  readonly navigation: NavigationMode;
  readonly route: GuardRoute;
  readonly pendingRouteFailure: string | null;
  readonly destinationReached: boolean;
  readonly lookSteps: number;
  /** Upgrade 1: facing on arrival at the patrol point; restored after the pause. */
  readonly pauseBaseFacing: Vector2 | null;
  readonly log: readonly TransitionRecord[];
  readonly lastRecord: TransitionRecord | null;
}

export interface GuardTickInput {
  readonly timeMs: number;
  readonly deltaMs: number;
  readonly playerPosition: Vector2;
  readonly newSound: SoundEvent | null;
  /** TP-05: a valid takedown happened this update (checked by the application). */
  readonly neutralize?: boolean;
}

export interface GuardTickResult {
  readonly state: GuardControllerState;
  readonly vision: VisionResult;
  readonly soundHeard: boolean;
  readonly record: TransitionRecord;
  readonly violations: readonly string[];
}

export function initialGuardController(
  config: GuardControllerConfig,
  algorithm: SearchAlgorithm = "astar",
): GuardControllerState {
  validateConfig(config);
  return {
    brain: initialGuardBrain(),
    perception: initialPerceptionState(),
    position: cellCenter(config.guardStart, config.tileSize),
    facing: { x: -1, y: 0 },
    algorithm,
    navigation: "direct",
    route: emptyRoute(0),
    pendingRouteFailure: null,
    destinationReached: false,
    lookSteps: 0,
    pauseBaseFacing: null,
    log: [],
    lastRecord: null,
  };
}

export function withAlgorithm(
  state: GuardControllerState,
  algorithm: SearchAlgorithm,
): GuardControllerState {
  // Forces a new search on the next update with the selected algorithm.
  return { ...state, algorithm, route: { ...state.route, goal: null } };
}

export function withNavigation(
  state: GuardControllerState,
  navigation: NavigationMode,
): GuardControllerState {
  // Forces a new search on the next update with the selected navigation.
  return { ...state, navigation, route: { ...state.route, goal: null } };
}

export function updateGuard(
  state: GuardControllerState,
  config: GuardControllerConfig,
  input: GuardTickInput,
): GuardTickResult {
  // 1. Perception (sensors and memory) from the current pose.
  const perceptionState = input.newSound
    ? withSoundEvent(state.perception, input.newSound)
    : state.perception;
  const frame = updatePerceptionSimulation(perceptionState, {
    map: config.map,
    tileSize: config.tileSize,
    observer: state.position,
    facing: state.facing,
    target: input.playerPosition,
    visionRange: config.visionRange,
    fieldOfViewRadians: config.fieldOfViewRadians,
    timeMs: input.timeMs,
  });
  const memory = frame.state.memory;

  // 2. Arbitration and decision: exactly one event for the FSM.
  const context: GuardContext = {
    timeMs: input.timeMs,
    lastKnownPosition: memory.lastKnownPosition,
    lastKnownSource: memory.source,
    patrolPointCount: config.patrolPoints.length,
  };
  const event: GuardEvent = input.neutralize ? { type: "neutralized" } : selectGuardEvent(state.brain.state, {
    visiblePlayerPosition: frame.vision.visible ? input.playerPosition : null,
    heardSoundPosition: frame.soundHeard && frame.state.soundEvent
      ? frame.state.soundEvent.position
      : null,
    routeFailure: state.pendingRouteFailure,
    destinationReached: state.destinationReached,
  });
  const step = stepGuard(state.brain, event, context, {
    searchDurationMs: config.searchDurationMs,
    patrolPauseMs: config.patrolPauseMs ?? 0,
  });
  const brain = step.brain;
  const changedState = step.record.kind === "transition";

  // 3. Route management: search only when the destination changes.
  let route = state.route;
  let pendingRouteFailure = step.record.event === "route-failed" ? null : state.pendingRouteFailure;
  let destinationReached = state.destinationReached;
  const goal = desiredGoal(brain, config);
  const guardCell = worldToCell(state.position, config.tileSize);

  if (!goal) {
    route = emptyRoute(state.route.searches);
    destinationReached = false;
    pendingRouteFailure = null;
  } else {
    const goalChanged = !route.goal || route.goal.x !== goal.x || route.goal.y !== goal.y;
    const chaseThrottled = brain.state === "chase"
      && !changedState
      && route.result?.status === "success"
      && input.timeMs - route.plannedAtMs < config.chaseReplanMs;
    if (changedState || (goalChanged && !chaseThrottled)) {
      const result = calculateRoute(config.map, guardCell, goal, state.algorithm, {
        entryCosts: state.navigation === "cautious" ? config.cautiousCosts : undefined,
      });
      route = {
        goal,
        result,
        waypoints: result.status === "success"
          ? buildWaypoints(result.path, config.tileSize, exactTarget(brain))
          : [],
        nextWaypoint: 0,
        plannedAtMs: input.timeMs,
        searches: state.route.searches + 1,
      };
      pendingRouteFailure = result.status === "success" ? null : result.status;
      destinationReached = false;
    }
  }

  // 4. Locomotion along the current route, or look around while searching.
  let position = state.position;
  let facing = state.facing;
  let lookSteps = changedState ? 0 : state.lookSteps;
  if (route.waypoints.length > 0) {
    const movement = advanceAlongPath(
      position,
      route.waypoints,
      route.nextWaypoint,
      config.guardSpeed * input.deltaMs / 1000,
    );
    position = movement.position;
    facing = movement.direction ?? facing;
    route = { ...route, nextWaypoint: movement.nextWaypoint };
    destinationReached = movement.completed;
  } else if (brain.state === "search") {
    const steps = Math.floor((input.timeMs - brain.enteredAtMs) / config.lookIntervalMs);
    if (steps > lookSteps) {
      for (let index = lookSteps; index < steps; index += 1) {
        facing = { x: -facing.y, y: facing.x };
      }
      lookSteps = steps;
    }
  }

  // Upgrade 1: look to one side and then the other while pausing, then restore.
  let pauseBaseFacing = state.pauseBaseFacing;
  if (brain.state === "patrol" && brain.pauseEndsAtMs !== null) {
    pauseBaseFacing ??= facing;
    const pauseMs = config.patrolPauseMs ?? 0;
    const elapsed = input.timeMs - (brain.pauseEndsAtMs - pauseMs);
    const amplitude = config.patrolLookRadians ?? Math.PI / 4;
    facing = rotate(pauseBaseFacing, elapsed < pauseMs / 2 ? -amplitude : amplitude);
  } else if (pauseBaseFacing) {
    if (route.waypoints.length === 0 || step.record.rule === "T14") {
      facing = pauseBaseFacing;
    }
    pauseBaseFacing = null;
  }

  const log = step.record.kind === "ignored"
    ? state.log
    : [...state.log, step.record].slice(-config.logLimit);
  const next: GuardControllerState = {
    brain,
    perception: frame.state,
    position,
    facing,
    algorithm: state.algorithm,
    navigation: state.navigation,
    route,
    pendingRouteFailure,
    destinationReached,
    lookSteps,
    pauseBaseFacing,
    log,
    lastRecord: step.record,
  };

  return {
    state: next,
    vision: frame.vision,
    soundHeard: frame.soundHeard,
    record: step.record,
    violations: [...checkGuardInvariants(brain, context), ...routeViolations(next, config)],
  };
}

function desiredGoal(brain: GuardBrain, config: GuardControllerConfig): GridPoint | null {
  if (brain.stalled) {
    return null;
  }
  switch (brain.state) {
    case "chase":
    case "investigate":
      return brain.target ? worldToCell(brain.target, config.tileSize) : null;
    case "patrol":
      // Upgrade 1: no route while pausing at a patrol point.
      return brain.pauseEndsAtMs !== null ? null : config.patrolPoints[brain.patrolIndex] ?? null;
    case "return":
      return config.patrolPoints[brain.patrolIndex] ?? null;
    case "search":
    case "neutralized":
      return null;
  }
}

/**
 * Converts a cell path into locomotion targets.
 * - When the route continues, the centre of the cell the guard already occupies is
 *   skipped: walking back to it made the guard turn around (playtest 2026-11-10).
 * - In Perseguir/Investigar the last target is the exact perceived position, so the
 *   guard faces it on arrival instead of stopping at the cell centre.
 * Both changes keep every segment inside two adjacent walkable cells.
 */
function buildWaypoints(
  path: readonly GridPoint[],
  tileSize: number,
  finalPosition: Vector2 | null,
): Vector2[] {
  const waypoints = path.map((point) => cellCenter(point, tileSize));
  if (waypoints.length > 1) {
    waypoints.shift();
  }
  if (finalPosition && waypoints.length > 0) {
    waypoints[waypoints.length - 1] = { ...finalPosition };
  }
  return waypoints;
}

function exactTarget(brain: GuardBrain): Vector2 | null {
  return brain.state === "chase" || brain.state === "investigate" ? brain.target : null;
}

function routeViolations(state: GuardControllerState, config: GuardControllerConfig): string[] {
  const path = state.route.result?.status === "success" ? state.route.result.path : [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!;
    if (!isWalkable(config.map, point)) {
      return [`I5: la ruta contiene una celda bloqueada (${point.x},${point.y})`];
    }
    const previous = path[index - 1];
    if (previous && Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) !== 1) {
      return ["I5: la ruta tiene un salto no cardinal"];
    }
  }
  return [];
}

function rotate(vector: Vector2, radians: number): Vector2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

function emptyRoute(searches: number): GuardRoute {
  return {
    goal: null,
    result: null,
    waypoints: [],
    nextWaypoint: 0,
    plannedAtMs: 0,
    searches,
  };
}

function validateConfig(config: GuardControllerConfig): void {
  if (config.patrolPoints.length === 0) {
    throw new Error("Guard needs at least one patrol point.");
  }
  for (const point of [config.guardStart, ...config.patrolPoints]) {
    if (!isWalkable(config.map, point)) {
      throw new Error(`Guard point is not walkable: ${point.x},${point.y}.`);
    }
  }
  for (const value of [
    config.guardSpeed,
    config.visionRange,
    config.searchDurationMs,
    config.lookIntervalMs,
    config.chaseReplanMs,
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Guard timings and distances must be finite and positive.");
    }
  }
}

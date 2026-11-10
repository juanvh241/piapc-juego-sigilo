import type { GuardControllerConfig } from "./guardController";
import { GUARD_START, LAB_MAP, PATROL_POINTS, TILE_SIZE } from "./labLevel";

/** Guard parameters shared by the Phaser scene and the integration tests. */
export const LAB_GUARD_CONFIG: GuardControllerConfig = {
  map: LAB_MAP,
  tileSize: TILE_SIZE,
  guardStart: GUARD_START,
  patrolPoints: PATROL_POINTS,
  guardSpeed: 115,
  visionRange: 220,
  fieldOfViewRadians: Math.PI / 2,
  searchDurationMs: 3000,
  lookIntervalMs: 750,
  chaseReplanMs: 250,
  logLimit: 50,
  // Upgrade 1 (docs/upgrades/01-patrulla-pausas-mirada/spec.md).
  patrolPauseMs: 1500,
  patrolLookRadians: Math.PI / 4,
};

export const SOUND_RADIUS = 190;
export const SOUND_DURATION_MS = 800;

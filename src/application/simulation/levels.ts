import { LEVEL_1_PARAMS, type BasementParams } from "../../domain/level/basementGenerator";

/** TP-06 — specs/tp-06-oscuridad-y-niveles.md: one parameter set per level, no duplicated code. */
export interface LevelConfig {
  readonly level: number;
  readonly basement: BasementParams;
  /** Radius of the player's light, in pixels (presentation). */
  readonly lightRadius: number;
}

export const LEVELS: readonly LevelConfig[] = [
  { level: 1, basement: LEVEL_1_PARAMS, lightRadius: 96 },
  { level: 2, basement: { ...LEVEL_1_PARAMS, glass: [30, 40] }, lightRadius: 72 },
];

export const LAST_LEVEL = LEVELS.length;

export function levelConfig(level: number): LevelConfig {
  const config = LEVELS[level - 1];
  if (!config) {
    throw new Error(`Unknown level ${level}.`);
  }
  return config;
}

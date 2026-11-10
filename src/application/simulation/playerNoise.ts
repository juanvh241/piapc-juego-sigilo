import { cellKey, type GridPoint } from "../../domain/model/grid";
import { assertFiniteVector, type Vector2 } from "../../domain/model/vector";
import type { SoundEvent } from "../../domain/perception/perception";

/**
 * TP-04 — specs/tp-04-ruido-del-jugador.md
 * Decides when the player makes noise. The guard only reacts through perception.
 */
export const STEP_INTERVAL_MS = 350;
export const STEP_RADIUS = 70;
export const STEP_DURATION_MS = 300;
export const GLASS_RADIUS = 220;
export const GLASS_DURATION_MS = 800;
export const WALK_SPEED = 190;
export const SNEAK_SPEED = 90;

export type NoiseKind = "glass" | "step";

export interface PlayerNoiseState {
  readonly lastStepMs: number | null;
  readonly lastCell: string;
}

export interface PlayerNoiseInput {
  readonly timeMs: number;
  readonly moving: boolean;
  readonly sneaking: boolean;
  readonly cell: GridPoint;
  readonly position: Vector2;
  readonly glassKeys: ReadonlySet<string>;
}

export interface PlayerNoiseResult {
  readonly state: PlayerNoiseState;
  readonly sound: SoundEvent | null;
  readonly kind: NoiseKind | null;
}

/** The start cell never makes noise, even if it had glass. */
export function initialPlayerNoise(startCell: GridPoint): PlayerNoiseState {
  return { lastStepMs: null, lastCell: cellKey(startCell) };
}

export function updatePlayerNoise(state: PlayerNoiseState, input: PlayerNoiseInput): PlayerNoiseResult {
  if (!Number.isFinite(input.timeMs)) {
    throw new Error("Noise time must be finite.");
  }
  assertFiniteVector(input.position);
  const key = cellKey(input.cell);
  const enteredNewCell = key !== state.lastCell;

  // Glass always sounds (also when sneaking), once per entry into the cell.
  if (enteredNewCell && input.glassKeys.has(key)) {
    return {
      state: { lastStepMs: state.lastStepMs, lastCell: key },
      sound: { position: { ...input.position }, radius: GLASS_RADIUS, emittedAtMs: input.timeMs, durationMs: GLASS_DURATION_MS },
      kind: "glass",
    };
  }

  if (input.moving && !input.sneaking) {
    if (state.lastStepMs === null || input.timeMs - state.lastStepMs >= STEP_INTERVAL_MS) {
      return {
        state: { lastStepMs: input.timeMs, lastCell: key },
        sound: { position: { ...input.position }, radius: STEP_RADIUS, emittedAtMs: input.timeMs, durationMs: STEP_DURATION_MS },
        kind: "step",
      };
    }
    return { state: { ...state, lastCell: key }, sound: null, kind: null };
  }

  // Standing still or sneaking: silent, and the step cadence restarts.
  return { state: { lastStepMs: null, lastCell: key }, sound: null, kind: null };
}

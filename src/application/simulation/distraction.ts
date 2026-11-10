import { cellCenter, isWalkable, worldToCell, type GridMap } from "../../domain/model/grid";
import { assertFiniteVector, distanceBetween, type Vector2 } from "../../domain/model/vector";
import type { SoundEvent } from "../../domain/perception/perception";

/**
 * Upgrade 7 — docs/upgrades/04-distractores-sonoros/spec.md
 * The player throws a noise to a clicked cell. The guard only reacts if it hears it,
 * through the same perception path as Q.
 */
export const THROW_RANGE_PX = 192;
export const THROW_COOLDOWN_MS = 2000;
export const DISTRACTION_RADIUS = 190;
export const DISTRACTION_DURATION_MS = 800;

export type DistractionRejection = "fuera-de-alcance" | "celda-bloqueada" | "enfriamiento";

export type DistractionResult =
  | { readonly accepted: true; readonly sound: SoundEvent }
  | { readonly accepted: false; readonly reason: DistractionRejection };

export interface DistractionInput {
  readonly player: Vector2;
  readonly target: Vector2;
  readonly map: GridMap;
  readonly tileSize: number;
  readonly nowMs: number;
  readonly lastThrowMs: number | null;
}

export function throwDistraction(input: DistractionInput): DistractionResult {
  assertFiniteVector(input.player);
  assertFiniteVector(input.target);
  if (!Number.isFinite(input.nowMs)) {
    throw new Error("Distraction time must be finite.");
  }
  if (input.lastThrowMs !== null && input.nowMs - input.lastThrowMs < THROW_COOLDOWN_MS) {
    return { accepted: false, reason: "enfriamiento" };
  }
  const cell = worldToCell(input.target, input.tileSize);
  if (!isWalkable(input.map, cell)) {
    return { accepted: false, reason: "celda-bloqueada" };
  }
  const landing = cellCenter(cell, input.tileSize);
  if (distanceBetween(input.player, landing) > THROW_RANGE_PX) {
    return { accepted: false, reason: "fuera-de-alcance" };
  }
  return {
    accepted: true,
    sound: {
      position: landing,
      radius: DISTRACTION_RADIUS,
      emittedAtMs: input.nowMs,
      durationMs: DISTRACTION_DURATION_MS,
    },
  };
}

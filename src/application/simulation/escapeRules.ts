import type { GuardStateName } from "../../domain/behavior/guardFsm";
import { cellKey, type GridPoint } from "../../domain/model/grid";
import { assertFiniteVector, distanceBetween, normalized, type Vector2 } from "../../domain/model/vector";

/**
 * TP-05 — specs/tp-05-cuchillo-y-escape.md
 * Player-side rules: takedown, capture and escape. Pure functions, no Phaser.
 */
export const TAKEDOWN_DISTANCE = 40;
export const CAPTURE_DISTANCE = 16;

export type TakedownRejection =
  | "sin-cuchillo"
  | "lejos"
  | "de-frente"
  | "persiguiendo"
  | "ya-neutralizado";

export type TakedownResult = { readonly ok: true } | { readonly ok: false; readonly reason: TakedownRejection };

export interface TakedownInput {
  readonly hasKnife: boolean;
  readonly player: Vector2;
  readonly guard: Vector2;
  readonly guardFacing: Vector2;
  readonly guardState: GuardStateName;
  readonly fieldOfViewRadians: number;
}

/** E is valid only with the knife, close, from behind (outside the cone) and not during a chase. */
export function checkTakedown(input: TakedownInput): TakedownResult {
  assertFiniteVector(input.player);
  assertFiniteVector(input.guard);
  if (input.guardState === "neutralized") return { ok: false, reason: "ya-neutralizado" };
  if (!input.hasKnife) return { ok: false, reason: "sin-cuchillo" };
  if (distanceBetween(input.player, input.guard) > TAKEDOWN_DISTANCE) return { ok: false, reason: "lejos" };
  if (input.guardState === "chase") return { ok: false, reason: "persiguiendo" };
  if (isInsideCone(input)) return { ok: false, reason: "de-frente" };
  return { ok: true };
}

/** Caught only while the guard is chasing and closer than 16 px. */
export function isCaught(guardState: GuardStateName, guard: Vector2, player: Vector2): boolean {
  return guardState === "chase" && distanceBetween(guard, player) < CAPTURE_DISTANCE;
}

/** The door only lets the player out once it is open (key obtained). */
export function canEscape(doorOpen: boolean, playerCell: GridPoint, exit: GridPoint): boolean {
  return doorOpen && cellKey(playerCell) === cellKey(exit);
}

function isInsideCone(input: TakedownInput): boolean {
  const facing = normalized(input.guardFacing);
  const toPlayer = normalized({ x: input.player.x - input.guard.x, y: input.player.y - input.guard.y });
  if (!facing || !toPlayer) {
    // Same position or no facing: treat as "in front" so the takedown is never free.
    return true;
  }
  const dot = facing.x * toPlayer.x + facing.y * toPlayer.y;
  return dot + 1e-10 >= Math.cos(input.fieldOfViewRadians / 2);
}

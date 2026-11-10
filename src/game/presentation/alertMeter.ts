import type { GuardStateName } from "../../domain/behavior/guardFsm";

/**
 * Upgrade 8 — docs/upgrades/05-medidor-alerta/spec.md
 * Alert meter 0..100 derived from the FSM state and vision. It only informs:
 * nothing in the behaviour reads it.
 */
export type AlertLevel = "calm" | "suspicion" | "alert";

export const RISE_WHEN_SEEN_PER_S = 200;
export const SUSPICION_TARGET = 60;
export const SUSPICION_RISE_PER_S = 60;
export const DECAY_PER_S = 25;

export function updateAlertMeter(
  value: number,
  state: GuardStateName,
  playerVisible: boolean,
  deltaMs: number,
): number {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new Error("Alert meter delta must be finite and non-negative.");
  }
  if (!Number.isFinite(value)) {
    throw new Error("Alert meter value must be finite.");
  }
  const seconds = deltaMs / 1000;
  let next: number;
  if (playerVisible || state === "chase") {
    next = value + RISE_WHEN_SEEN_PER_S * seconds;
  } else if (state === "investigate" || state === "search") {
    next = value < SUSPICION_TARGET
      ? Math.min(SUSPICION_TARGET, value + SUSPICION_RISE_PER_S * seconds)
      : Math.max(SUSPICION_TARGET, value - DECAY_PER_S * seconds);
  } else {
    next = value - DECAY_PER_S * seconds;
  }
  return Math.min(100, Math.max(0, next));
}

export function alertLevel(value: number): AlertLevel {
  if (value < 34) {
    return "calm";
  }
  return value <= 66 ? "suspicion" : "alert";
}

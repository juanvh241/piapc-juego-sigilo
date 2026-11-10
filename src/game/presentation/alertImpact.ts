import type { TransitionRecord } from "../../domain/behavior/guardFsm";

/**
 * Upgrade 4 — docs/upgrades/03-impacto-visual-alerta/spec.md
 * Decides when to play the detection impact (camera shake + red flash).
 */
export const ALERT_COOLDOWN_MS = 1000;
export const ALERT_SHAKE_MS = 250;
export const ALERT_SHAKE_INTENSITY = 0.006;
export const ALERT_FLASH_MS = 150;

export function shouldTriggerAlert(
  record: TransitionRecord,
  lastTriggerMs: number | null,
  nowMs: number,
): boolean {
  if (!Number.isFinite(nowMs)) {
    throw new Error("Alert time must be finite.");
  }
  const enteredChase = record.kind === "transition" && record.rule === "T1" && record.to === "chase";
  if (!enteredChase) {
    return false;
  }
  return lastTriggerMs === null || nowMs - lastTriggerMs >= ALERT_COOLDOWN_MS;
}

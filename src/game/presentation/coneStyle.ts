import type { GuardStateName } from "../../domain/behavior/guardFsm";

/**
 * Upgrade 2 — docs/upgrades/02-cono-vision-reactivo/spec.md
 * Pure presentation: the cone style follows the FSM state and the vision result.
 * It never changes what the guard can see.
 */
export interface ConeStyle {
  readonly fillColor: number;
  readonly fillAlpha: number;
  readonly outline: boolean;
}

export const CONE_COLORS: Readonly<Record<GuardStateName, number>> = {
  patrol: 0x6b8afd,
  return: 0xa98bf0,
  investigate: 0xe5b454,
  search: 0xe58f54,
  chase: 0xe16969,
  neutralized: 0x5a6470,
};

const ALERT_STATES: ReadonlySet<GuardStateName> = new Set(["investigate", "search", "chase"]);

export function coneStyle(state: GuardStateName, playerVisible: boolean): ConeStyle {
  return {
    fillColor: CONE_COLORS[state],
    fillAlpha: playerVisible ? 0.32 : 0.16,
    outline: ALERT_STATES.has(state),
  };
}

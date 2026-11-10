import type { Basement } from "../../domain/level/basementGenerator";
import type { GuardControllerConfig } from "./guardController";
import { LAB_GUARD_CONFIG } from "./labGuard";

/** TP-03: entry cost of a glass cell in the cautious navigation (other cells cost 1). */
export const GLASS_COST = 5;

/**
 * TP-02/TP-03: guard configuration for a generated basement. Behaviour parameters are the
 * same as in the lab; map, start, patrol points and glass costs come from the basement.
 */
export function guardConfigFor(basement: Basement): GuardControllerConfig {
  return {
    ...LAB_GUARD_CONFIG,
    map: basement.map,
    guardStart: basement.guardStart,
    patrolPoints: basement.patrolPoints,
    cautiousCosts: new Map([...basement.glassKeys].map((key) => [key, GLASS_COST])),
  };
}

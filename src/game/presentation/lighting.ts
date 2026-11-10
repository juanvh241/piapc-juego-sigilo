/**
 * TP-06 lighting (revision after the 2026-11-10 playtest).
 * Pure presentation: decides which circles of light exist and what they reveal.
 * The guard's light is visual only; it never changes perception or behaviour.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LightCircle extends Point {
  readonly radius: number;
}

export const DARKNESS_ALPHA = 0.94;
export const GUARD_LIGHT_RADIUS = 56;
export const ITEM_LIGHT_RADIUS = 40;

export interface LightingInput {
  readonly player: Point;
  readonly playerRadius: number;
  readonly guard: Point;
  /** Knife position while it has not been taken; null afterwards. */
  readonly knife: Point | null;
  /** Door position once it is open; null while closed. */
  readonly openDoor: Point | null;
}

export function lightSources(input: LightingInput): LightCircle[] {
  const lights: LightCircle[] = [
    { ...input.player, radius: input.playerRadius },
    { ...input.guard, radius: GUARD_LIGHT_RADIUS },
  ];
  if (input.knife) lights.push({ ...input.knife, radius: ITEM_LIGHT_RADIUS });
  if (input.openDoor) lights.push({ ...input.openDoor, radius: ITEM_LIGHT_RADIUS });
  return lights;
}

export function isLit(point: Point, lights: readonly LightCircle[]): boolean {
  return lights.some((light) => Math.hypot(point.x - light.x, point.y - light.y) <= light.radius);
}

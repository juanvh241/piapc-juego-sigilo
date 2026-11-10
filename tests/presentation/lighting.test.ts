import { describe, expect, it } from "vitest";
import { GUARD_LIGHT_RADIUS, isLit, ITEM_LIGHT_RADIUS, lightSources } from "../../src/game/presentation/lighting";

// specs/tp-06-oscuridad-y-niveles.md — revision after the 2026-11-10 playtest.
const BASE = { player: { x: 0, y: 0 }, playerRadius: 96, guard: { x: 600, y: 300 }, knife: { x: 300, y: 500 }, openDoor: null };

describe("TP-06 guide lights", () => {
  it("the guard and the knife are lit even far from the player", () => {
    const lights = lightSources(BASE);
    expect(isLit(BASE.guard, lights)).toBe(true);
    expect(isLit({ x: 600 + GUARD_LIGHT_RADIUS, y: 300 }, lights)).toBe(true);
    expect(isLit({ x: 600 + GUARD_LIGHT_RADIUS + 1, y: 300 }, lights)).toBe(false);
    expect(isLit(BASE.knife, lights)).toBe(true);
    // A spot far from every light stays dark.
    expect(isLit({ x: 900, y: 50 }, lights)).toBe(false);
  });

  it("the knife stops glowing once taken; the door glows only when open", () => {
    const door = { x: 900, y: 600 };
    const closed = lightSources({ ...BASE, knife: null });
    expect(isLit({ x: 300, y: 500 }, closed)).toBe(false);
    expect(isLit(door, closed)).toBe(false);
    const open = lightSources({ ...BASE, knife: null, openDoor: door });
    expect(isLit({ x: door.x + ITEM_LIGHT_RADIUS, y: door.y }, open)).toBe(true);
  });
});

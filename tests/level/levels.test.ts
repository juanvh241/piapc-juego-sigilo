import { describe, expect, it } from "vitest";
import { LAST_LEVEL, levelConfig } from "../../src/application/simulation/levels";
import { generateBasement, validateBasement } from "../../src/domain/level/basementGenerator";

// specs/tp-06-oscuridad-y-niveles.md
describe("TP-06 levels", () => {
  it("level 2 has more glass and less light than level 1", () => {
    const one = levelConfig(1);
    const two = levelConfig(2);
    expect(LAST_LEVEL).toBe(2);
    expect(two.basement.glass).toEqual([30, 40]);
    expect(two.lightRadius).toBeLessThan(one.lightRadius);
    expect(() => levelConfig(3)).toThrow();
  });

  it("100 seeds of level 2 produce valid basements with 30 to 40 glass cells", { timeout: 20_000 }, () => {
    const params = levelConfig(2).basement;
    let fallbacks = 0;
    for (let index = 0; index < 100; index += 1) {
      const basement = generateBasement(index * 104_729 + 3, params);
      expect(validateBasement(basement, params), `seed ${basement.seed}`).toEqual([]);
      expect(basement.glass.length).toBeGreaterThanOrEqual(30);
      expect(basement.glass.length).toBeLessThanOrEqual(40);
      if (basement.usedFallback) fallbacks += 1;
    }
    expect(fallbacks).toBe(0);
  });
});

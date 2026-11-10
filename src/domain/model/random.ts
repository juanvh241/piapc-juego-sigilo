/** Deterministic random source in [0, 1). Injected so that generation is reproducible in tests. */
export type Random = () => number;

/** Small, well-known 32-bit PRNG (mulberry32). */
export function mulberry32(seed: number): Random {
  if (!Number.isInteger(seed)) {
    throw new Error("Seed must be an integer.");
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max], both inclusive. */
export function randomInt(random: Random, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`Invalid integer range ${min}..${max}.`);
  }
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty list.");
  }
  return item;
}

export function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

// Deterministic randomness for the seed. The same seed number always yields the
// same traffic, so demo data, screenshots, and e2e runs agree with each other.
export type Rng = () => number;

/** mulberry32: a tiny, well-distributed 32-bit PRNG. */
export const createRng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Box-Muller transform: a standard normal sample from two uniforms. */
const standardNormal = (rng: Rng): number => {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Log-normal sample. Real page timings are right-skewed: most loads cluster
 * near the median and a long tail is slow. `sigma` is the spread of the
 * underlying normal (0.3 tight, 0.7 wide).
 */
export const logNormal = ({ rng, median, sigma }: { rng: Rng; median: number; sigma: number }): number =>
  median * Math.exp(sigma * standardNormal(rng));

export interface Weighted<T> {
  value: T;
  weight: number;
}

export const pickWeighted = <T>(rng: Rng, options: ReadonlyArray<Weighted<T>>): T => {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = rng() * totalWeight;
  for (const option of options) {
    roll -= option.weight;
    if (roll < 0) {
      return option.value;
    }
  }
  return options[options.length - 1].value;
};

export const randomInt = (rng: Rng, minInclusive: number, maxInclusive: number): number =>
  minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));

export const uniform = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

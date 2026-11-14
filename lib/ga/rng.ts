/**
 * シード付き疑似乱数生成器 (mulberry32)。
 * 同じシードなら同じ問題・同じ進化過程を再現できるため、学習用デモに向いている。
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [0, max) の整数 */
export function randInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

/** Fisher–Yates シャッフル（破壊的） */
export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

import { createRng, randInt, shuffle, type Rng } from "./rng";
import { evaluate, type Chromosome, type Evaluation, type Problem } from "./vrp";

/**
 * 遺伝的アルゴリズム (GA) 本体。
 *
 * 1 世代の流れ:
 *   1. 評価      各個体のコスト（総距離 + ペナルティ）を計算
 *   2. エリート  上位 eliteCount 個体をそのまま次世代へ
 *   3. 選択      トーナメント選択で親を 2 体選ぶ
 *   4. 交叉      確率 crossoverRate で順序交叉 (OX)
 *   5. 突然変異  確率 mutationRate で 交換 or 逆位
 *   6. 次世代が populationSize に達するまで 3〜5 を繰り返す
 */

export type MutationType = "swap" | "inversion";

export type GAConfig = {
  populationSize: number;
  crossoverRate: number;
  mutationRate: number;
  eliteCount: number;
  tournamentSize: number;
  mutationType: MutationType;
  seed: number;
};

export const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 100,
  crossoverRate: 0.9,
  mutationRate: 0.2,
  eliteCount: 2,
  tournamentSize: 3,
  mutationType: "inversion",
  seed: 1,
};

/** 交叉の記録: 親1 の区間 [a, b] を子へコピーした */
export type CrossoverRecord = { a: number; b: number };

/** 突然変異の記録: 位置 i, j（交換）または区間 [i, j]（逆位） */
export type MutationRecord = { type: MutationType; i: number; j: number };

/**
 * 個体がどのように生まれたか。
 * parents は「前世代（コスト順にソート済み）」での順位（0 = 最良）。
 */
export type Origin =
  | { kind: "random" }
  | { kind: "elite"; parent: number }
  | {
      kind: "offspring";
      parents: [number, number];
      crossover: CrossoverRecord | null;
      /** 交叉直後（突然変異前）の染色体 */
      beforeMutation: Chromosome;
      beforeMutationCost: number;
      mutation: MutationRecord | null;
    };

export type Individual = {
  chromosome: Chromosome;
  eval: Evaluation;
  origin: Origin;
};

export type GenerationStats = {
  generation: number;
  best: number;
  average: number;
  worst: number;
  /** 異なる染色体の割合（多様性の目安） */
  diversity: number;
  /** 位置エントロピー（0〜1）: 各遺伝子座にどれだけ多様な顧客が現れるか */
  entropy: number;
  /** この世代で交叉により生まれた子の数 / そのうち両親より良くなった数 */
  crossoverCount: number;
  crossoverImproved: number;
  /** この世代で突然変異した子の数 / そのうち突然変異で良くなった数 */
  mutationCount: number;
  mutationImproved: number;
};

// ---------- 遺伝的操作 ----------

/**
 * トーナメント選択: ランダムに k 体選び、最もコストの小さい個体の順位を返す。
 * pop はコスト順にソート済みなので「順位が小さい = 優秀」。
 */
export function tournamentSelect(rng: Rng, pop: Individual[], k: number): number {
  let best = randInt(rng, pop.length);
  for (let i = 1; i < k; i++) {
    const cand = randInt(rng, pop.length);
    if (pop[cand].eval.cost < pop[best].eval.cost) best = cand;
  }
  return best;
}

/**
 * 順序交叉 (OX: Order Crossover)
 * 親1 の区間 [a, b] をそのまま子へコピーし、残りは親2 に現れる順で埋める。
 * 順列の性質（各顧客がちょうど1回）を壊さない交叉。
 */
export function orderCrossover(
  rng: Rng,
  p1: Chromosome,
  p2: Chromosome,
): { child: Chromosome; record: CrossoverRecord } {
  const n = p1.length;
  let a = randInt(rng, n);
  let b = randInt(rng, n);
  if (a > b) [a, b] = [b, a];

  const child: number[] = new Array(n).fill(-1);
  const used = new Set<number>();
  for (let i = a; i <= b; i++) {
    child[i] = p1[i];
    used.add(p1[i]);
  }
  let pos = (b + 1) % n;
  for (let k = 0; k < n; k++) {
    const gene = p2[(b + 1 + k) % n];
    if (used.has(gene)) continue;
    child[pos] = gene;
    pos = (pos + 1) % n;
  }
  return { child, record: { a, b } };
}

/** 交換突然変異: 2 つの遺伝子を入れ替える */
export function swapMutation(rng: Rng, c: Chromosome): { child: Chromosome; record: MutationRecord } {
  const out = c.slice();
  let i = randInt(rng, out.length);
  let j = randInt(rng, out.length);
  if (i > j) [i, j] = [j, i];
  [out[i], out[j]] = [out[j], out[i]];
  return { child: out, record: { type: "swap", i, j } };
}

/** 逆位突然変異: 区間を反転する（経路の交差をほどく 2-opt に相当） */
export function inversionMutation(
  rng: Rng,
  c: Chromosome,
): { child: Chromosome; record: MutationRecord } {
  const out = c.slice();
  let i = randInt(rng, out.length);
  let j = randInt(rng, out.length);
  if (i > j) [i, j] = [j, i];
  for (let l = i, r = j; l < r; l++, r--) {
    [out[l], out[r]] = [out[r], out[l]];
  }
  return { child: out, record: { type: "inversion", i, j } };
}

// ---------- GA エンジン ----------

type OperatorCounts = Pick<
  GenerationStats,
  "crossoverCount" | "crossoverImproved" | "mutationCount" | "mutationImproved"
>;

const ZERO_COUNTS: OperatorCounts = {
  crossoverCount: 0,
  crossoverImproved: 0,
  mutationCount: 0,
  mutationImproved: 0,
};

export class GeneticAlgorithm {
  readonly problem: Problem;
  readonly config: GAConfig;
  private rng: Rng;
  generation = 0;
  population: Individual[] = [];
  private lastCounts: OperatorCounts = ZERO_COUNTS;

  constructor(problem: Problem, config: GAConfig) {
    this.problem = problem;
    this.config = config;
    this.rng = createRng(config.seed);
    this.population = this.initialPopulation();
  }

  private initialPopulation(): Individual[] {
    const n = this.problem.customers.length;
    const base = Array.from({ length: n }, (_, i) => i);
    const pop = Array.from({ length: this.config.populationSize }, (): Individual => {
      const chromosome = shuffle(this.rng, base.slice());
      return { chromosome, eval: evaluate(this.problem, chromosome), origin: { kind: "random" } };
    });
    return sortByCost(pop);
  }

  get best(): Individual {
    return this.population[0];
  }

  stats(): GenerationStats {
    const pop = this.population;
    const costs = pop.map((p) => p.eval.cost);
    const unique = new Set(pop.map((p) => p.chromosome.join(","))).size;
    return {
      generation: this.generation,
      best: costs[0],
      average: costs.reduce((s, c) => s + c, 0) / costs.length,
      worst: costs[costs.length - 1],
      diversity: unique / costs.length,
      entropy: positionalEntropy(pop.map((p) => p.chromosome), this.problem.customers.length),
      ...this.lastCounts,
    };
  }

  /** 1 世代進める */
  step(): void {
    const { populationSize, eliteCount, crossoverRate, mutationRate, tournamentSize, mutationType } =
      this.config;
    const rng = this.rng;
    const prev = this.population;
    const counts = { ...ZERO_COUNTS };

    // エリート: 上位個体をそのままコピー
    const next: Individual[] = prev
      .slice(0, Math.min(eliteCount, populationSize))
      .map((ind, rank) => ({ ...ind, origin: { kind: "elite", parent: rank } }));

    const mutate = mutationType === "swap" ? swapMutation : inversionMutation;

    while (next.length < populationSize) {
      // 選択
      const i1 = tournamentSelect(rng, prev, tournamentSize);
      const i2 = tournamentSelect(rng, prev, tournamentSize);
      const p1 = prev[i1];
      const p2 = prev[i2];

      // 交叉
      let child: Chromosome;
      let crossover: CrossoverRecord | null = null;
      if (rng() < crossoverRate) {
        const r = orderCrossover(rng, p1.chromosome, p2.chromosome);
        child = r.child;
        crossover = r.record;
      } else {
        child = p1.chromosome.slice();
      }
      const beforeMutation = child;
      const beforeEval = evaluate(this.problem, beforeMutation);
      if (crossover) {
        counts.crossoverCount++;
        if (beforeEval.cost < Math.min(p1.eval.cost, p2.eval.cost)) counts.crossoverImproved++;
      }

      // 突然変異
      let mutation: MutationRecord | null = null;
      let childEval = beforeEval;
      if (rng() < mutationRate) {
        const r = mutate(rng, child);
        child = r.child;
        mutation = r.record;
        childEval = evaluate(this.problem, child);
        counts.mutationCount++;
        if (childEval.cost < beforeEval.cost) counts.mutationImproved++;
      }

      next.push({
        chromosome: child,
        eval: childEval,
        origin: {
          kind: "offspring",
          parents: [i1, i2],
          crossover,
          beforeMutation,
          beforeMutationCost: beforeEval.cost,
          mutation,
        },
      });
    }

    this.population = sortByCost(next);
    this.lastCounts = counts;
    this.generation++;
  }
}

function sortByCost(pop: Individual[]): Individual[] {
  return pop.sort((a, b) => a.eval.cost - b.eval.cost);
}

/**
 * 位置エントロピー: 遺伝子座ごとに「どの顧客が何回現れるか」のエントロピーを求め、平均する。
 * 1 に近いほど個体群がバラバラ（多様）、0 に近いほど全員が同じ並び（収束）。
 */
export function positionalEntropy(chromosomes: Chromosome[], n: number): number {
  const m = chromosomes.length;
  if (m <= 1 || n <= 1) return 0;
  const maxH = Math.log(Math.min(m, n));
  const counts = new Array<number>(n);
  let total = 0;
  for (let pos = 0; pos < n; pos++) {
    counts.fill(0);
    for (const c of chromosomes) counts[c[pos]]++;
    let h = 0;
    for (const k of counts) {
      if (k > 0) {
        const p = k / m;
        h -= p * Math.log(p);
      }
    }
    total += h / maxH;
  }
  return total / n;
}

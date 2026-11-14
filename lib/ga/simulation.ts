import { GeneticAlgorithm, type GAConfig, type GenerationStats, type Individual } from "./ga";
import { generateProblem, type Chromosome, type Problem, type ProblemOptions } from "./vrp";

/** 個体群（全染色体と生まれ方）を保持する直近の世代数 */
export const POPULATION_RETENTION = 300;

/**
 * GA の実行と、世代ごとの記録（統計値・最良個体・直近の個体群）をまとめて保持する。
 * フロントエンドはこれを使って過去の世代を巻き戻して確認できる。
 */
export class GASimulation {
  readonly problem: Problem;
  readonly ga: GeneticAlgorithm;
  readonly history: GenerationStats[] = [];
  /** snapshots[g] = 第 g 世代の最良個体の染色体 */
  readonly snapshots: Chromosome[] = [];
  /** 直近 POPULATION_RETENTION 世代分の個体群 */
  private populations = new Map<number, Individual[]>();

  constructor(problemOptions: ProblemOptions, config: GAConfig) {
    this.problem = generateProblem(problemOptions);
    this.ga = new GeneticAlgorithm(this.problem, config);
    this.record();
  }

  get generation(): number {
    return this.ga.generation;
  }

  private record(): void {
    this.history.push(this.ga.stats());
    this.snapshots.push(this.ga.best.chromosome);
    this.populations.set(this.ga.generation, this.ga.population);
    this.populations.delete(this.ga.generation - POPULATION_RETENTION);
  }

  /** 第 g 世代の個体群（保持期間外なら undefined） */
  populationAt(g: number): Individual[] | undefined {
    return this.populations.get(g);
  }

  /** n 世代進める（上限 maxGeneration まで） */
  advance(n: number, maxGeneration: number): void {
    for (let i = 0; i < n && this.ga.generation < maxGeneration; i++) {
      this.ga.step();
      this.record();
    }
  }
}

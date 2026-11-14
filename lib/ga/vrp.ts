import { createRng, randInt } from "./rng";

/**
 * 容量制約付き配送経路問題 (CVRP: Capacitated Vehicle Routing Problem)
 *
 * - 1つのデポ（配送センター）から複数の車両が出発し、全顧客を1回ずつ訪問してデポへ戻る
 * - 各車両の積載量（顧客の需要の合計）は容量 capacity を超えてはならない
 * - 目的: 全車両の総走行距離を最小化する
 *
 * 巡回セールスマン問題 (TSP) を一般化した問題であり NP 困難。
 */

export type Point = { x: number; y: number };

export type Customer = Point & {
  id: number;
  demand: number;
};

export type Problem = {
  depot: Point;
  customers: Customer[];
  capacity: number;
  /** 使用可能な車両台数。超過した分はペナルティ */
  maxVehicles: number;
  /** dist[i][j]: ノード i, j 間の距離。ノード 0 = デポ、ノード k (k>=1) = customers[k-1] */
  dist: number[][];
};

export type ProblemOptions = {
  seed: number;
  customerCount: number;
  capacity: number;
  maxVehicles: number;
  /** 座標空間の一辺 */
  size?: number;
};

export function generateProblem(opts: ProblemOptions): Problem {
  const size = opts.size ?? 100;
  const rng = createRng(opts.seed);
  const depot: Point = { x: size / 2, y: size / 2 };
  const customers: Customer[] = [];
  for (let i = 0; i < opts.customerCount; i++) {
    customers.push({
      id: i,
      x: 5 + rng() * (size - 10),
      y: 5 + rng() * (size - 10),
      demand: 1 + randInt(rng, 9), // 1〜9
    });
  }

  const nodes: Point[] = [depot, ...customers];
  const dist = nodes.map((a) => nodes.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));

  return { depot, customers, capacity: opts.capacity, maxVehicles: opts.maxVehicles, dist };
}

/** 染色体 = 顧客インデックス（0 始まり）の順列。「巨大巡回路 (giant tour)」とも呼ばれる */
export type Chromosome = number[];

/** 1台の車両が回る顧客インデックスの列 */
export type Route = number[];

/**
 * デコード: 順列を先頭から読み、容量を超える直前で車両を切り替える（貪欲分割）。
 * こうすることで、どんな順列も必ず容量制約を満たす解になる。
 */
export function decode(problem: Problem, chromosome: Chromosome): Route[] {
  const routes: Route[] = [];
  let current: Route = [];
  let load = 0;
  for (const c of chromosome) {
    const d = problem.customers[c].demand;
    if (load + d > problem.capacity && current.length > 0) {
      routes.push(current);
      current = [];
      load = 0;
    }
    current.push(c);
    load += d;
  }
  if (current.length > 0) routes.push(current);
  return routes;
}

export function routeDistance(problem: Problem, route: Route): number {
  const { dist } = problem;
  let total = 0;
  let prev = 0; // depot
  for (const c of route) {
    total += dist[prev][c + 1];
    prev = c + 1;
  }
  total += dist[prev][0];
  return total;
}

export function routeLoad(problem: Problem, route: Route): number {
  return route.reduce((s, c) => s + problem.customers[c].demand, 0);
}

/** 車両台数超過 1 台あたりのペナルティ（距離換算） */
export const VEHICLE_PENALTY = 100;

export type Evaluation = {
  routes: Route[];
  distance: number;
  /** 適応度の元になるコスト（小さいほど良い）= 距離 + ペナルティ */
  cost: number;
};

export function evaluate(problem: Problem, chromosome: Chromosome): Evaluation {
  const routes = decode(problem, chromosome);
  const distance = routes.reduce((s, r) => s + routeDistance(problem, r), 0);
  const over = Math.max(0, routes.length - problem.maxVehicles);
  return { routes, distance, cost: distance + over * VEHICLE_PENALTY };
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_GA_CONFIG, type GAConfig, type Individual, type MutationType } from "@/lib/ga/ga";
import { GASimulation, POPULATION_RETENTION } from "@/lib/ga/simulation";
import { evaluate, routeDistance, routeLoad, type ProblemOptions } from "@/lib/ga/vrp";
import { FitnessChart } from "./FitnessChart";
import { LineChart } from "./LineChart";
import { OperatorAnatomy } from "./OperatorAnatomy";
import { PopulationMap } from "./PopulationMap";
import { RouteView, routeColor } from "./RouteView";

const DEFAULT_PROBLEM: ProblemOptions = {
  seed: 42,
  customerCount: 30,
  capacity: 50,
  maxVehicles: 5,
};

const SPEEDS = [1, 5, 20, 50];

export function GaVrpDemo() {
  const [problemOpts, setProblemOpts] = useState<ProblemOptions>(DEFAULT_PROBLEM);
  const [gaConfig, setGaConfig] = useState<GAConfig>(DEFAULT_GA_CONFIG);
  const [maxGeneration, setMaxGeneration] = useState(1000);
  const [speed, setSpeed] = useState(5);
  const [sim, setSim] = useState(() => new GASimulation(DEFAULT_PROBLEM, DEFAULT_GA_CONFIG));
  const [running, setRunning] = useState(false);
  /** null = 最新世代に追従 */
  const [viewGen, setViewGen] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  /** 詳細で選択中の個体の順位。null = 自動（交叉＋突然変異で生まれた最上位の個体） */
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  // sim は可変オブジェクトなので、進めた後に再描画を促すためのカウンタ
  const [, setTick] = useState(0);

  const reset = (p: ProblemOptions, g: GAConfig) => {
    setRunning(false);
    setViewGen(null);
    setSelectedRank(null);
    setSim(new GASimulation(p, g));
  };
  const updateProblem = (patch: Partial<ProblemOptions>) => {
    const next = { ...problemOpts, ...patch };
    setProblemOpts(next);
    reset(next, gaConfig);
  };
  const updateGa = (patch: Partial<GAConfig>) => {
    const next = { ...gaConfig, ...patch };
    setGaConfig(next);
    reset(problemOpts, next);
  };

  // アニメーションループ: 1 フレームごとに speed 世代進める
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const loop = () => {
      sim.advance(speed, maxGeneration);
      setTick((t) => t + 1);
      if (sim.generation >= maxGeneration) {
        setRunning(false);
        return;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running, sim, speed, maxGeneration]);

  const latest = sim.generation;
  const shownGen = viewGen === null ? latest : Math.min(viewGen, latest);
  const chromosome = sim.snapshots[shownGen];
  const shown = useMemo(() => evaluate(sim.problem, chromosome), [sim, chromosome]);
  const stats = sim.history[shownGen];
  const initialBest = sim.history[0].best;
  const improvement = ((initialBest - stats.best) / initialBest) * 100;
  const done = latest >= maxGeneration;
  const totalDemand = sim.problem.customers.reduce((s, c) => s + c.demand, 0);

  const population = sim.populationAt(shownGen);
  const prevPopulation = sim.populationAt(shownGen - 1);
  const rank = population ? Math.min(selectedRank ?? autoRank(population), population.length - 1) : 0;
  const operatorRates = {
    crossover: movingAverage(
      sim.history.map((h) => (h.crossoverCount > 0 ? h.crossoverImproved / h.crossoverCount : NaN)),
      20,
    ),
    mutation: movingAverage(
      sim.history.map((h) => (h.mutationCount > 0 ? h.mutationImproved / h.mutationCount : NaN)),
      20,
    ),
  };

  const start = () => {
    setViewGen(null);
    setRunning(true);
  };
  const stepOnce = () => {
    setViewGen(null);
    sim.advance(1, maxGeneration);
    setTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- ツールバー（常に表示） ---------- */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-800">
        <Button onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen}>
          {settingsOpen ? "◀ 設定を閉じる" : "▶ 設定を開く"}
        </Button>
        <span className="mx-1 h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
        {running ? (
          <Button onClick={() => setRunning(false)} primary>
            一時停止
          </Button>
        ) : (
          <Button onClick={start} primary disabled={done}>
            {latest === 0 ? "開始" : "再開"}
          </Button>
        )}
        <Button onClick={stepOnce} disabled={running || done}>
          1世代進める
        </Button>
        <Button onClick={() => reset(problemOpts, gaConfig)}>リセット</Button>
        <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="ml-2">速度</span>
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeed(sp)}
              className={`rounded border px-2 py-1 text-xs ${
                speed === sp
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              ×{sp}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs text-zinc-500">
          第 {latest} / {maxGeneration} 世代{running ? "（実行中）" : done ? "（完了）" : ""}
        </span>
      </div>

      <div className={`grid gap-6 ${settingsOpen ? "lg:grid-cols-[320px_1fr]" : ""}`}>
        {/* ---------- 設定パネル（折りたたみ可） ---------- */}
        <aside className={`flex flex-col gap-5 ${settingsOpen ? "" : "hidden"}`}>
          <Section title="実行設定">
            <Range
              label="最大世代数"
              value={maxGeneration}
              min={100}
              max={5000}
              step={100}
              onChange={setMaxGeneration}
            />
          </Section>

          <Section title="問題設定（変更するとリセット）">
            <Range
              label="顧客数"
              value={problemOpts.customerCount}
              min={5}
              max={100}
              onChange={(v) => updateProblem({ customerCount: v })}
            />
            <Range
              label="車両の容量"
              value={problemOpts.capacity}
              min={10}
              max={100}
              onChange={(v) => updateProblem({ capacity: v })}
            />
            <Range
              label="車両台数の上限"
              value={problemOpts.maxVehicles}
              min={1}
              max={20}
              onChange={(v) => updateProblem({ maxVehicles: v })}
            />
            <NumberInput
              label="問題のシード"
              value={problemOpts.seed}
              onChange={(v) => updateProblem({ seed: v })}
            />
          </Section>

          <Section title="GA パラメータ（変更するとリセット）">
            <Range
              label="個体数"
              value={gaConfig.populationSize}
              min={10}
              max={500}
              step={10}
              onChange={(v) =>
                updateGa({ populationSize: v, eliteCount: Math.min(gaConfig.eliteCount, v) })
              }
            />
            <Range
              label="交叉率"
              value={gaConfig.crossoverRate}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateGa({ crossoverRate: v })}
            />
            <Range
              label="突然変異率"
              value={gaConfig.mutationRate}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateGa({ mutationRate: v })}
            />
            <Field label="突然変異の種類">
              <select
                value={gaConfig.mutationType}
                onChange={(e) => updateGa({ mutationType: e.target.value as MutationType })}
                className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              >
                <option value="inversion">逆位（区間を反転）</option>
                <option value="swap">交換（2点を入れ替え）</option>
              </select>
            </Field>
            <Range
              label="エリート数"
              value={gaConfig.eliteCount}
              min={0}
              max={Math.min(20, gaConfig.populationSize)}
              onChange={(v) => updateGa({ eliteCount: v })}
            />
            <Range
              label="トーナメントサイズ"
              value={gaConfig.tournamentSize}
              min={2}
              max={10}
              onChange={(v) => updateGa({ tournamentSize: v })}
            />
            <NumberInput label="GA のシード" value={gaConfig.seed} onChange={(v) => updateGa({ seed: v })} />
          </Section>
        </aside>

        {/* ---------- 可視化 ---------- */}
        <section className="flex min-w-0 flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="世代" value={`${shownGen} / ${latest}`} />
            <Stat label="最良コスト" value={stats.best.toFixed(1)} sub={`初期比 −${improvement.toFixed(1)}%`} />
            <Stat
              label="使用車両"
              value={`${shown.routes.length} 台`}
              sub={shown.routes.length > sim.problem.maxVehicles ? `上限 ${sim.problem.maxVehicles} 台を超過` : `上限 ${sim.problem.maxVehicles} 台`}
              warn={shown.routes.length > sim.problem.maxVehicles}
            />
            <Stat label="多様性" value={`${(stats.diversity * 100).toFixed(0)}%`} sub="異なる個体の割合" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">第 {shownGen} 世代の最良解</h2>
              <RouteView problem={sim.problem} routes={shown.routes} />
              <Range
                label="世代を巻き戻して確認"
                value={shownGen}
                min={0}
                max={latest}
                disabled={running}
                onChange={(v) => setViewGen(v === latest ? null : v)}
              />
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-2 text-sm font-semibold">コストの推移</h2>
                <FitnessChart
                  history={sim.history}
                  maxGeneration={maxGeneration}
                  markerGeneration={shownGen}
                  onSelectGeneration={(g) => !running && setViewGen(g === latest ? null : g)}
                />
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold">
                  車両ごとの内訳
                  <span className="ml-2 font-normal text-zinc-500">
                    総需要 {totalDemand} / 容量 {sim.problem.capacity}
                  </span>
                </h2>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-zinc-500">
                    <tr>
                      <th className="py-1">車両</th>
                      <th>訪問数</th>
                      <th>積載</th>
                      <th className="text-right">距離</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.routes.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                        <td className="py-1">
                          <span
                            className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: routeColor(i) }}
                          />
                          {i + 1}
                        </td>
                        <td>{r.length}</td>
                        <td>
                          {routeLoad(sim.problem, r)} / {sim.problem.capacity}
                        </td>
                        <td className="text-right tabular-nums">{routeDistance(sim.problem, r).toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-300 font-semibold dark:border-zinc-700">
                      <td className="py-1">合計</td>
                      <td>{sim.problem.customers.length}</td>
                      <td>{totalDemand}</td>
                      <td className="text-right tabular-nums">{shown.distance.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h2 className="mb-1 text-sm font-semibold">染色体（顧客の訪問順）</h2>
                <p className="break-all rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
                  [{chromosome.map((c) => c + 1).join(", ")}]
                </p>
              </div>
            </div>
          </div>

          {/* ---------- 詳細 ---------- */}
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <button
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              className="flex items-center gap-2 text-left text-base font-semibold"
            >
              <span className="text-xs">{detailsOpen ? "▼" : "▶"}</span>
              詳細: 第 {shownGen} 世代の個体群と遺伝的操作
            </button>

            {detailsOpen && (
              <>
                {population ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">個体群マップ（{population.length} 個体）</h3>
                      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                        1 行＝1 個体（上ほど優秀）、横＝訪問順、色＝顧客。縦に同じ色が揃うほど個体群が似通っています。行をクリックすると右に詳細を表示します。
                      </p>
                      <PopulationMap
                        population={population}
                        customerCount={sim.problem.customers.length}
                        selected={rank}
                        onSelect={setSelectedRank}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-sm font-semibold">交叉・突然変異の解剖</h3>
                        <Button onClick={() => setSelectedRank(Math.max(rank - 1, 0))} disabled={rank === 0}>
                          ▲
                        </Button>
                        <Button
                          onClick={() => setSelectedRank(Math.min(rank + 1, population.length - 1))}
                          disabled={rank === population.length - 1}
                        >
                          ▼
                        </Button>
                        <span className="text-xs text-zinc-500">第 {rank + 1} 位</span>
                      </div>
                      <OperatorAnatomy
                        individual={population[rank]}
                        rank={rank}
                        generation={shownGen}
                        prevPopulation={prevPopulation}
                        customerCount={sim.problem.customers.length}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    個体群の記録は直近 {POPULATION_RETENTION} 世代分のみ保持しています。スライダーで新しい世代を選ぶと表示されます。
                  </p>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">多様性の推移</h3>
                    <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                      選択圧で個体群が収束すると低下し、突然変異がそれを押し戻します。
                    </p>
                    <LineChart
                      xMax={maxGeneration}
                      yMin={0}
                      yMax={1}
                      marker={shownGen}
                      formatY={(v) => `${Math.round(v * 100)}%`}
                      series={[
                        { label: "位置エントロピー（並びのばらつき）", color: "#0891b2", values: sim.history.map((h) => h.entropy) },
                        { label: "異なる個体の割合", color: "#a855f7", values: sim.history.map((h) => h.diversity), dashed: true },
                      ]}
                    />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">遺伝的操作の成功率（20 世代移動平均）</h3>
                    <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
                      交叉: 子が両親より良くなった割合／突然変異: 変異で子が良くなった割合。収束が進むと改善は難しくなります。
                    </p>
                    <LineChart
                      xMax={maxGeneration}
                      yMin={0}
                      yMax={Math.max(0.05, ...operatorRates.crossover.filter(Number.isFinite), ...operatorRates.mutation.filter(Number.isFinite))}
                      marker={shownGen}
                      formatY={(v) => `${(v * 100).toFixed(0)}%`}
                      series={[
                        { label: "交叉の成功率", color: "#3b82f6", values: operatorRates.crossover },
                        { label: "突然変異の成功率", color: "#ef4444", values: operatorRates.mutation, dashed: true },
                      ]}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** 既定で解剖図に表示する個体: 交叉＋突然変異で生まれた最上位 → 子の最上位 → 1位 */
function autoRank(pop: Individual[]): number {
  const both = pop.findIndex((p) => p.origin.kind === "offspring" && p.origin.crossover && p.origin.mutation);
  if (both >= 0) return both;
  const child = pop.findIndex((p) => p.origin.kind === "offspring");
  return child >= 0 ? child : 0;
}

/** NaN を無視した移動平均（直近 window 世代） */
function movingAverage(values: number[], window: number): number[] {
  const out: number[] = [];
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i])) {
      sum += values[i];
      cnt++;
    }
    const drop = i - window;
    if (drop >= 0 && Number.isFinite(values[drop])) {
      sum -= values[drop];
      cnt--;
    }
    out.push(cnt > 0 ? sum / cnt : NaN);
  }
  return out;
}

// ---------- 小さな UI 部品 ----------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
      {label}
      {children}
    </label>
  );
}

function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
      <span className="flex justify-between">
        {props.label}
        <span className="font-mono text-zinc-900 dark:text-zinc-100">{props.value}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="accent-blue-600"
      />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono text-sm dark:border-zinc-700"
      />
    </Field>
  );
}

function Button(props: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  "aria-expanded"?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      aria-expanded={props["aria-expanded"]}
      disabled={props.disabled}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
        props.primary
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      }`}
    >
      {props.children}
    </button>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className={`text-xs ${warn ? "text-red-600" : "text-zinc-500"}`}>{sub}</div>}
    </div>
  );
}

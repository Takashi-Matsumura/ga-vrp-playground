"use client";

import type { GenerationStats } from "@/lib/ga/ga";

type Props = {
  history: GenerationStats[];
  maxGeneration: number;
  markerGeneration: number;
  onSelectGeneration: (gen: number) => void;
};

const W = 600;
const H = 220;
const PAD = { l: 48, r: 12, t: 12, b: 28 };
const MAX_POINTS = 600;

/** 世代ごとの最良コスト・平均コストの推移グラフ。クリックでその世代へ移動 */
export function FitnessChart({ history, maxGeneration, markerGeneration, onSelectGeneration }: Props) {
  const xMax = Math.max(maxGeneration, 1);
  const yMin = Math.min(...history.map((h) => h.best));
  const yMax = Math.max(...history.map((h) => h.average));
  const ySpan = Math.max(yMax - yMin, 1e-6);

  const x = (g: number) => PAD.l + (g / xMax) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / ySpan) * (H - PAD.t - PAD.b);

  const stride = Math.max(1, Math.ceil(history.length / MAX_POINTS));
  const sampled = history.filter((_, i) => i % stride === 0 || i === history.length - 1);
  const line = (key: "best" | "average") =>
    sampled.map((h) => `${x(h.generation).toFixed(1)},${y(h[key]).toFixed(1)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * ySpan);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const g = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * xMax);
    onSelectGeneration(Math.min(Math.max(g, 0), history.length - 1));
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair rounded-lg border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
        onClick={handleClick}
        role="img"
        aria-label="世代ごとのコスト推移"
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.15} />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="currentColor">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize={10} fill="currentColor">
          0
        </text>
        <text x={W - PAD.r} y={H - 8} fontSize={10} textAnchor="end" fill="currentColor">
          {xMax} 世代
        </text>

        <polyline points={line("average")} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
        <polyline points={line("best")} fill="none" stroke="#2563eb" strokeWidth={2} />

        <line
          x1={x(markerGeneration)}
          x2={x(markerGeneration)}
          y1={PAD.t}
          y2={H - PAD.b}
          stroke="#dc2626"
          strokeWidth={1}
        />
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-blue-600" /> 最良コスト
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" /> 平均コスト
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-red-600" /> 表示中の世代（クリックで移動）
        </span>
      </div>
    </div>
  );
}

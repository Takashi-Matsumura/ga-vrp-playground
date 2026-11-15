export type Series = {
  label: string;
  color: string;
  /** values[g] = 第 g 世代の値。NaN は描画しない */
  values: number[];
  dashed?: boolean;
};

type Props = {
  series: Series[];
  xMax: number;
  yMin: number;
  yMax: number;
  marker?: number;
  formatY?: (v: number) => string;
};

const W = 600;
const H = 180;
const PAD = { l: 40, r: 10, t: 10, b: 22 };
const MAX_POINTS = 500;

/** 世代を横軸にした汎用の折れ線グラフ */
export function LineChart({ series, xMax, yMin, yMax, marker, formatY = (v) => v.toFixed(2) }: Props) {
  const xm = Math.max(xMax, 1);
  const span = Math.max(yMax - yMin, 1e-9);
  const x = (g: number) => PAD.l + (g / xm) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / span) * (H - PAD.t - PAD.b);

  const path = (values: number[]) => {
    const stride = Math.max(1, Math.ceil(values.length / MAX_POINTS));
    let d = "";
    let pen = false;
    for (let g = 0; g < values.length; g += stride) {
      const v = values[g];
      if (!Number.isFinite(v)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(g).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {[0, 0.5, 1].map((t) => {
          const v = yMin + t * span;
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.15} />
              <text x={PAD.l - 5} y={y(v) + 3} textAnchor="end" fontSize={10} fill="currentColor">
                {formatY(v)}
              </text>
            </g>
          );
        })}
        <text x={W - PAD.r} y={H - 6} fontSize={10} textAnchor="end" fill="currentColor">
          {xm} 世代
        </text>
        {series.map((s) => (
          <path
            key={s.label}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.75}
            strokeDasharray={s.dashed ? "4 3" : undefined}
          />
        ))}
        {marker !== undefined && (
          <line x1={x(marker)} x2={x(marker)} y1={PAD.t} y2={H - PAD.b} stroke="#dc2626" strokeWidth={1} />
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-zinc-600 dark:text-zinc-400">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span
              className="inline-block w-4 border-t-2"
              style={{ borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

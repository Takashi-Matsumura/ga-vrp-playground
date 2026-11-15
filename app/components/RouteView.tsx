import { routeLoad, type Problem, type Route } from "@/lib/ga/vrp";

export const ROUTE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#7c3aed",
  "#ea580c",
];

export function routeColor(i: number): string {
  return ROUTE_COLORS[i % ROUTE_COLORS.length];
}

type Props = {
  problem: Problem;
  routes: Route[];
};

/** デポ・顧客・各車両の経路を SVG で描画する */
export function RouteView({ problem, routes }: Props) {
  const { depot, customers } = problem;
  return (
    <svg
      viewBox="-2 -2 104 104"
      className="aspect-square w-full rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      role="img"
      aria-label="配送経路の可視化"
    >
      {routes.map((route, i) => {
        const pts = [depot, ...route.map((c) => customers[c]), depot]
          .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
          .join(" ");
        return (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke={routeColor(i)}
            strokeWidth={0.6}
            strokeLinejoin="round"
            opacity={0.85}
          >
            <title>{`車両 ${i + 1}: 積載 ${routeLoad(problem, route)} / ${problem.capacity}`}</title>
          </polyline>
        );
      })}

      {customers.map((c) => (
        <g key={c.id}>
          <circle
            cx={c.x}
            cy={c.y}
            r={0.8 + c.demand * 0.15}
            className="fill-zinc-700 dark:fill-zinc-300"
          >
            <title>{`顧客 ${c.id + 1}（需要 ${c.demand}）`}</title>
          </circle>
        </g>
      ))}

      <rect
        x={depot.x - 2}
        y={depot.y - 2}
        width={4}
        height={4}
        className="fill-zinc-950 stroke-white dark:fill-white dark:stroke-zinc-950"
        strokeWidth={0.4}
      >
        <title>デポ（配送センター）</title>
      </rect>
    </svg>
  );
}

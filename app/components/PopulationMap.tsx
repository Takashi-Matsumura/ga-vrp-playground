"use client";

import { useEffect, useRef } from "react";
import type { Individual } from "@/lib/ga/ga";
import { ORIGIN_STYLES, geneColor, originCategory, type OriginCategory } from "./geneColor";

type Props = {
  population: Individual[];
  customerCount: number;
  selected: number;
  onSelect: (rank: number) => void;
};

/** 先頭の「生まれ方」タグ列 + 区切り列 */
const TAG_COLS = 2;

/**
 * 個体群マップ: 1 行 = 1 個体（上ほど優秀）、1 列 = 遺伝子座、色 = 顧客。
 * 世代が進むと縦方向に同じ色が揃っていき、個体群が収束（多様性が低下）する様子が見える。
 */
export function PopulationMap({ population, customerCount, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rows = population.length;
  const cols = customerCount + TAG_COLS;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cols, rows);
    population.forEach((ind, r) => {
      ctx.fillStyle = ORIGIN_STYLES[originCategory(ind.origin)].color;
      ctx.fillRect(0, r, 1, 1);
      ind.chromosome.forEach((gene, c) => {
        ctx.fillStyle = geneColor(gene, customerCount);
        ctx.fillRect(c + TAG_COLS, r, 1, 1);
      });
    });
  }, [population, customerCount, cols, rows]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * rows);
    onSelect(Math.min(Math.max(r, 0), rows - 1));
  };

  const present = new Set(population.map((p) => originCategory(p.origin)));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={cols}
          height={rows}
          onClick={handleClick}
          className="h-80 w-full cursor-pointer rounded border border-zinc-200 dark:border-zinc-800"
          style={{ imageRendering: "pixelated" }}
          aria-label="個体群マップ"
        />
        <div
          className="pointer-events-none absolute inset-x-0 border-y-2 border-zinc-950 dark:border-white"
          style={{
            top: `${(selected / rows) * 100}%`,
            height: `max(${100 / rows}%, 3px)`,
          }}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span>左端の色＝生まれ方:</span>
        {(Object.keys(ORIGIN_STYLES) as OriginCategory[])
          .filter((k) => present.has(k))
          .map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ORIGIN_STYLES[k].color }} />
              {ORIGIN_STYLES[k].label}
            </span>
          ))}
      </div>
    </div>
  );
}

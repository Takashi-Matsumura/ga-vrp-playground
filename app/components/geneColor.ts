import type { Origin } from "@/lib/ga/ga";

/** 顧客（遺伝子）ごとの色。個体群マップと交叉の解剖図で共通に使う */
export function geneColor(id: number, n: number): string {
  const hue = Math.round((id * 360) / Math.max(n, 1));
  return `hsl(${hue} 65% 52%)`;
}

export type OriginCategory = "random" | "elite" | "both" | "crossover" | "mutation" | "copy";

export function originCategory(origin: Origin): OriginCategory {
  if (origin.kind !== "offspring") return origin.kind;
  if (origin.crossover && origin.mutation) return "both";
  if (origin.crossover) return "crossover";
  if (origin.mutation) return "mutation";
  return "copy";
}

export const ORIGIN_STYLES: Record<OriginCategory, { color: string; label: string }> = {
  elite: { color: "#eab308", label: "エリート（そのまま残存）" },
  both: { color: "#a855f7", label: "交叉 + 突然変異" },
  crossover: { color: "#3b82f6", label: "交叉のみ" },
  mutation: { color: "#ef4444", label: "突然変異のみ" },
  copy: { color: "#a1a1aa", label: "親の複製" },
  random: { color: "#d4d4d8", label: "ランダム生成" },
};

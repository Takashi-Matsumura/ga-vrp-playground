import type { Individual } from "@/lib/ga/ga";
import type { Chromosome } from "@/lib/ga/vrp";
import { ORIGIN_STYLES, geneColor, originCategory } from "./geneColor";

type Mark = "p1" | "p2" | "mut" | "fade" | undefined;

type Props = {
  individual: Individual;
  rank: number;
  generation: number;
  /** 前世代の個体群（保持期間外なら undefined） */
  prevPopulation: Individual[] | undefined;
  customerCount: number;
};

/** 選んだ個体が「どの親から、どの遺伝的操作で」生まれたかを遺伝子単位で図解する */
export function OperatorAnatomy({ individual, rank, generation, prevPopulation, customerCount: n }: Props) {
  const { origin } = individual;
  const cat = originCategory(origin);

  if (origin.kind === "random") {
    return (
      <Frame note="第 0 世代の個体は、顧客の順番をランダムに並べ替えて作られます。">
        <Row label="個体" sub={cost(individual.eval.cost)} genes={individual.chromosome} n={n} />
      </Frame>
    );
  }

  if (origin.kind === "elite") {
    return (
      <Frame
        note={`エリート保存: 前世代の第 ${origin.parent + 1} 位の個体が、交叉も突然変異も受けずにそのまま残りました。`}
      >
        <Row label="個体" sub={cost(individual.eval.cost)} genes={individual.chromosome} n={n} />
      </Frame>
    );
  }

  if (!prevPopulation) {
    return (
      <Frame note="この世代の親の記録は保持期間外のため表示できません（直近の世代のみ保持しています）。">
        <Row label="個体" sub={cost(individual.eval.cost)} genes={individual.chromosome} n={n} />
      </Frame>
    );
  }

  const [i1, i2] = origin.parents;
  const p1 = prevPopulation[i1];
  const p2 = prevPopulation[i2];
  const cx = origin.crossover;
  const mut = origin.mutation;

  // 交叉のマーキング
  const inSeg = (pos: number) => !!cx && pos >= cx.a && pos <= cx.b;
  const segGenes = new Set(cx ? p1.chromosome.slice(cx.a, cx.b + 1) : []);
  const p1Marks: Mark[] = p1.chromosome.map((_, pos) => (cx ? (inSeg(pos) ? "p1" : "fade") : "p1"));
  const p2Marks: Mark[] = p2.chromosome.map((g) => (cx ? (segGenes.has(g) ? "fade" : "p2") : "fade"));
  const childMarks: Mark[] = origin.beforeMutation.map((_, pos) => (cx ? (inSeg(pos) ? "p1" : "p2") : "p1"));

  // 突然変異のマーキング
  const changed = (pos: number) =>
    !!mut && (mut.type === "swap" ? pos === mut.i || pos === mut.j : pos >= mut.i && pos <= mut.j);
  const mutMarks: Mark[] = individual.chromosome.map((_, pos) => (changed(pos) ? "mut" : undefined));

  const bestParent = Math.min(p1.eval.cost, cx ? p2.eval.cost : Infinity);
  const delta = individual.eval.cost - bestParent;

  return (
    <Frame
      note={
        <>
          第 {generation} 世代 第 {rank + 1} 位の個体は
          <span className="mx-1 rounded px-1 text-white" style={{ background: ORIGIN_STYLES[cat].color }}>
            {ORIGIN_STYLES[cat].label}
          </span>
          で生まれました。親{cx ? "（良い方）" : ""}と比べてコストが
          <b className={delta < 0 ? "mx-1 text-green-600" : delta > 0 ? "mx-1 text-red-600" : "mx-1"}>
            {delta < 0 ? `${(-delta).toFixed(1)} 改善` : delta > 0 ? `${delta.toFixed(1)} 悪化` : "変化なし"}
          </b>
          しています。
        </>
      }
    >
      <Row label={`親1（前世代 ${i1 + 1} 位）`} sub={cost(p1.eval.cost)} genes={p1.chromosome} marks={p1Marks} n={n} />
      {cx && (
        <Row label={`親2（前世代 ${i2 + 1} 位）`} sub={cost(p2.eval.cost)} genes={p2.chromosome} marks={p2Marks} n={n} />
      )}
      <Step>
        {cx ? (
          <>
            ▼ 順序交叉（OX）: 親1 の区間 [{cx.a + 1}–{cx.b + 1}] を
            <Swatch mark="p1" />
            そのまま受け継ぎ、残りを親2 に現れる順で
            <Swatch mark="p2" />
            埋める
          </>
        ) : (
          <>▼ 交叉なし: 親1 をそのまま複製</>
        )}
      </Step>
      <Row label="交叉後" sub={cost(origin.beforeMutationCost)} genes={origin.beforeMutation} marks={childMarks} n={n} />
      <Step>
        {mut ? (
          mut.type === "inversion" ? (
            <>
              ▼ 逆位: 区間 [{mut.i + 1}–{mut.j + 1}] を反転
              <Swatch mark="mut" />
            </>
          ) : (
            <>
              ▼ 交換: 位置 {mut.i + 1} と {mut.j + 1} を入れ替え
              <Swatch mark="mut" />
            </>
          )
        ) : (
          <>▼ 突然変異なし</>
        )}
      </Step>
      <Row
        label="最終的な子"
        sub={cost(individual.eval.cost)}
        genes={individual.chromosome}
        marks={mut ? mutMarks : undefined}
        n={n}
      />
    </Frame>
  );
}

function cost(c: number) {
  return `コスト ${c.toFixed(1)}`;
}

function Frame({ note, children }: { note: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{note}</p>
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max flex-col gap-1">{children}</div>
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 py-0.5 pl-32 text-xs text-zinc-600 dark:text-zinc-400">{children}</div>
  );
}

const MARK_CLASS: Record<NonNullable<Mark>, string> = {
  p1: "ring-2 ring-blue-600 ring-inset",
  p2: "ring-2 ring-orange-500 ring-inset",
  mut: "ring-[3px] ring-red-600 ring-inset",
  fade: "opacity-25",
};

function Swatch({ mark }: { mark: NonNullable<Mark> }) {
  return <span className={`mx-1 inline-block h-3 w-3 rounded-sm bg-zinc-300 dark:bg-zinc-600 ${MARK_CLASS[mark]}`} />;
}

function Row({
  label,
  sub,
  genes,
  marks,
  n,
}: {
  label: string;
  sub: string;
  genes: Chromosome;
  marks?: Mark[];
  n: number;
}) {
  return (
    <div className="flex items-center">
      <div className="sticky left-0 z-10 w-32 shrink-0 bg-background pr-2 text-xs leading-tight">
        <div className="font-medium">{label}</div>
        <div className="text-zinc-500">{sub}</div>
      </div>
      <div className="flex gap-px">
        {genes.map((g, pos) => {
          const m = marks?.[pos];
          return (
            <span
              key={pos}
              title={`位置 ${pos + 1}: 顧客 ${g + 1}`}
              className={`flex h-6 w-6 items-center justify-center rounded-sm font-mono text-[10px] font-semibold text-white ${m ? MARK_CLASS[m] : ""}`}
              style={{ background: geneColor(g, n), textShadow: "0 0 2px rgb(0 0 0 / 0.7)" }}
            >
              {g + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

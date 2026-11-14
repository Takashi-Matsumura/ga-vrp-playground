import { GaVrpDemo } from "./components/GaVrpDemo";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">遺伝的アルゴリズムで解く配送経路問題</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          デポ（■）から複数の車両が出発し、すべての顧客（●、大きさは需要量）を回って戻ってくる経路を探します。
          各車両の積載量には上限があり、目的は総走行距離の最小化です。顧客が増えると組み合わせが爆発的に増える
          NP 困難な問題なので、遺伝的アルゴリズム（GA）で「十分に良い解」を世代を重ねて探索します。
        </p>
      </header>

      <GaVrpDemo />

      <section className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
        <Explain title="1. 遺伝子の表現">
          染色体は「顧客の訪問順」の順列です。先頭から順に積み込み、容量を超える直前で次の車両に切り替える
          （貪欲分割）ことで、どの順列も容量制約を満たす解に変換されます。
        </Explain>
        <Explain title="2. 評価（適応度）">
          コスト = 総走行距離 + 車両台数の超過 1 台あたり 100 のペナルティ。コストが小さい個体ほど優秀です。
        </Explain>
        <Explain title="3. 選択">
          トーナメント選択：個体群からランダムに数体選び、その中で最も優秀な個体を親にします。
          トーナメントサイズを大きくすると選択圧が強まり、収束が速く（多様性は低く）なります。
        </Explain>
        <Explain title="4. 交叉">
          順序交叉（OX）：親 1 の一区間をそのまま受け継ぎ、残りを親 2 に現れる順に埋めます。
          「各顧客をちょうど 1 回訪問」という順列の性質を保ったまま、両親の特徴を組み合わせます。
        </Explain>
        <Explain title="5. 突然変異">
          逆位は区間を反転させ、経路の交差をほどく効果があります（2-opt 法に相当）。交換は 2 顧客を入れ替えます。
          探索が局所解に陥るのを防ぎ、多様性を保ちます。
        </Explain>
        <Explain title="6. エリート保存">
          上位の個体は変更せず次世代へ残します。これにより最良コストは世代を重ねても悪化しません。
        </Explain>
      </section>
    </main>
  );
}

function Explain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}

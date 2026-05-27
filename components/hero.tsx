export function Hero() {
  return (
    <section className="surface overflow-hidden rounded-3xl p-4 sm:p-6 md:rounded-[2rem] md:p-8">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-8">
      <div className="flex min-w-0 flex-col justify-between gap-8 sm:gap-10">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex w-fit rounded-full border border-violetline/40 bg-violetline/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-violet-200 sm:text-xs sm:tracking-[0.22em]">
              Swarms ACM Submission
            </div>
            <div className="inline-flex w-fit rounded-full border border-terminal/30 bg-terminal/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-terminal sm:text-xs sm:tracking-[0.18em]">
              Agent Capital Markets
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Sentinel Alpha
            </h1>
            <p className="text-xl font-medium leading-snug text-violet-100 sm:text-2xl">Evidence-first Solana DeFi research swarm</p>
            <p className="max-w-3xl text-base leading-7 text-zinc-300">
              Coordinates specialized agents using live market, on-chain, news, and sentiment intelligence.
              Every conclusion is tied to source evidence, missing data is labeled, and outputs stay in
              decision-support territory.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300 sm:grid-cols-4 sm:gap-3">
          {["Live evidence", "Agent traces", "Risk intelligence", "Decision chains"].map((item) => (
            <span key={item} className="panel rounded-2xl px-3 py-3 text-center">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="panel min-w-0 rounded-3xl p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 sm:text-sm sm:tracking-[0.22em]">Supported Sources</p>
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-400">live-first</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {["DexScreener", "Jupiter", "Helius", "Birdeye", "RSS", "Reddit"].map((source) => (
            <div key={source} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-3 sm:p-4">
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-terminal/80 to-violetline/70" />
              <p className="mt-3 text-sm font-semibold">{source}</p>
              <p className="mt-1 text-xs text-zinc-500">{source === "Helius" || source === "Birdeye" ? "optional" : "runtime"}</p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}

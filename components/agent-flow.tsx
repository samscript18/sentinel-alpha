const agents = [
  {
    name: "Researcher",
    detail: "Live market, route, optional on-chain, news, and social evidence"
  },
  {
    name: "Analyst",
    detail: "Technical availability, liquidity context, route quality, fundamentals"
  },
  {
    name: "Risk Manager",
    detail: "Liquidity, volatility proxy, route, data completeness, alert triggers"
  },
  {
    name: "Recommender",
    detail: "Evidence-cited decision-support category and monitoring plan"
  }
];

export function AgentFlow() {
  return (
    <section className="surface rounded-3xl p-4 sm:p-6 md:rounded-[2rem] md:p-7">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-violet-300">Architecture</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Sequential Multi-Agent Desk</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-zinc-400">
          The dashboard is a visual layer over the same evidence packet used by the CLI and Swarms payload.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {agents.map((agent, index) => (
          <div key={agent.name} className="panel relative min-w-0 overflow-hidden rounded-3xl p-4 sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violetline/80 via-terminal/60 to-transparent" />
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violetline/30 bg-violetline/15 text-sm font-bold text-violet-100">
                {String(index + 1).padStart(2, "0")}
              </div>
              <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">agent</span>
            </div>
            <h3 className="text-lg font-semibold">{agent.name}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{agent.detail}</p>
            {index < agents.length - 1 ? (
              <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-violetline/60 xl:block" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

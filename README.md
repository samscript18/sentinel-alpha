# Sentinel Alpha

Sentinel Alpha is an evidence-first Solana DeFi trading research swarm for the Swarms ACM Hackathon. It fetches live market evidence, routes that evidence through four specialized agents, and produces a structured decision-support report.

Sentinel Alpha does not provide financial advice, execute trades, custody funds, or invent unavailable market data.

## What It Does

Given a Solana token mint, Sentinel Alpha produces:

- live data source status
- research evidence summary
- analyst observations
- risk flags
- confidence score based on data completeness
- optional news and social evidence
- illustrative risk exposure scenarios
- active alerts
- monitoring triggers
- final recommendation category: `WATCH`, `HIGH RISK`, `AVOID`, `RESEARCH FURTHER`, or `MONITOR CLOSELY`
- JSON and Markdown run artifacts

## Why It Matters

Solana traders often rely on fragmented dashboards, social feeds, and incomplete market signals. Basic AI trading prompts can hide uncertainty or hallucinate missing metrics. Sentinel Alpha makes the evidence layer explicit before any agent forms a thesis.

## Agent Workflow

```text
Live Data Preflight
  DexScreener
  Jupiter
  optional Helius
  optional Birdeye
        |
        v
Researcher Agent
        |
        v
Analyst Agent
        |
        v
Risk Manager Agent
        |
        v
Executor/Recommender Agent
```

The Swarms payload uses a directed `AgentRearrange` flow:

```text
Researcher Agent -> Analyst Agent -> Risk Manager Agent -> Executor/Recommender Agent
```

## Data Sources

- DexScreener: Solana token pairs, price fields, liquidity, volume, pair metadata.
- Jupiter: route and quote availability.
- Helius: optional DAS token metadata when `HELIUS_API_KEY` is configured.
- Birdeye: optional token overview when `BIRDEYE_API_KEY` is configured.
- CoinDesk RSS and CoinTelegraph RSS: optional recent news evidence without project-specific keys.
- CryptoPanic, GNews, and NewsAPI: optional news evidence when API keys are configured.
- Reddit and LunarCrush: optional social evidence where available or configured.

If a source fails, rate-limits, returns no data, or lacks a key, Sentinel Alpha reports that state instead of filling the gap with made-up values.

## File Structure

```text
.
├── .env.example
├── README.md
├── LAUNCH_FORM.md
├── SUBMISSION.md
├── marketplace-listing.md
├── package.json
├── swarm.payload.json
├── prompts/
│   └── system.md
├── scripts/
│   ├── run-swarm.ts
│   ├── validate.ts
│   └── lib/
│       ├── env.ts
│       ├── report.ts
│       ├── source-clients.ts
│       └── types.ts
└── tsconfig.json
```

## Environment Variables

Required for a full Swarms run:

```text
SWARMS_API_KEY=
```

Optional:

```text
HELIUS_API_KEY=
BIRDEYE_API_KEY=
DEFAULT_SOLANA_TOKEN_ADDRESS=
SWARMS_TIMEOUT_MS=200000
JUPITER_QUOTE_AMOUNT_BASE_UNITS=100000000
CRYPTOPANIC_API_KEY=
GNEWS_API_KEY=
NEWS_API_KEY=
LUNARCRUSH_API_KEY=
```

`SWARMS_TIMEOUT_MS` controls how long the runner waits for the multi-agent Swarms call. The default is 200 seconds.

`JUPITER_QUOTE_AMOUNT_BASE_UNITS` controls the route-check quote size. The default for wrapped SOL is `100000000` base units, displayed as `Quote Input: 0.1 SOL equivalent`; it is not a recommended trade size.

## Setup

```bash
cd /Users/mac/Desktop/projects/hackathons/defi-trading-swarm
npm install
cp .env.example .env
npm run validate
```

Add `SWARMS_API_KEY` to `.env` before running the full demo.

## Scripts

Validate submission quality:

```bash
npm run validate
```

Run live-data preflight only, without calling Swarms:

```bash
npm run preflight -- So11111111111111111111111111111111111111112
```

Run the full live-data + Swarms agent workflow:

```bash
npm run demo -- So11111111111111111111111111111111111111112
```

Run the TypeScript entrypoint directly:

```bash
node --experimental-strip-types scripts/run-swarm.ts --token So11111111111111111111111111111111111111112
```

Static markdown context files are not accepted at runtime. Optional examples may exist for documentation, but they are never injected into the agent workflow.

## Expected Output

The final agent returns:

1. Agent Execution Timeline
2. Data Source Status
3. Research Evidence Summary
4. Analyst Observations
5. Risk Flags
6. Confidence Score
7. Active Alerts
8. Monitoring Triggers
9. Final Recommendation Category
10. Disclaimer

Each run writes trace artifacts to `artifacts/runs/`:

- JSON: source packet, agent input, and Swarms response when available.
- Markdown: judge-friendly report with source status, confidence, timeline, and final output.
- `agent-trace-*.json`: ordered agent execution trace.
- `decision-chain-*.json`: confidence chain, risk model, and decision chain.
- `evidence-report-*.md`: source evidence and agent evidence blocks.

## Risk And Alert Model

Sentinel Alpha generates evidence-backed risk dimensions only when source data exists:

- Liquidity Risk
- Volatility Risk
- Concentration Risk
- Market Risk
- Data Completeness Risk
- Execution Risk
- Route Risk
- News Risk
- Sentiment Risk

Active alerts are reserved for conditions observed in the current evidence packet. Monitoring triggers describe future conditions to watch, such as liquidity drops, volume changes, route unavailability, source errors, and news or sentiment gaps.

## Hackathon Positioning

Sentinel Alpha fits Agent Capital Markets because it packages market intelligence as a reusable, tokenizable agent workflow for Swarms Marketplace. It has clear real-world utility: rapid token research triage with source traceability, conservative risk framing, and no fake metrics.

## Marketplace Publishing

Use [marketplace-listing.md](marketplace-listing.md) for the Swarms Marketplace listing.

Launch URL:

```text
https://swarms.world/launch?type=prompt&model=tokenized&frenzy=true
```

## Disclaimer

Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute transactions, and should not be the sole basis for investment or trading decisions.

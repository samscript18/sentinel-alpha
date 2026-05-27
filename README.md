# Sentinel Alpha

Sentinel Alpha is an evidence-first Solana DeFi research swarm for the Swarms ACM Hackathon. It combines a working CLI agent workflow with a responsive Next.js dashboard that visualizes live source status, agent traces, risk intelligence, decision chains, and downloadable artifacts.

Sentinel Alpha does not provide financial advice, execute trades, custody funds, invent unavailable market data, or generate price targets.

## What It Does

Given a Solana token mint, Sentinel Alpha produces:

- live data source status
- market, route, optional on-chain, optional news, and optional social evidence
- research evidence summary
- analyst observations
- risk flags
- confidence score based on data completeness
- illustrative risk exposure scenarios
- active alerts
- monitoring triggers
- final decision-support category: `WATCH`, `HIGH RISK`, `AVOID`, `RESEARCH FURTHER`, or `MONITOR CLOSELY`
- JSON, Markdown, agent trace, decision-chain, and evidence artifacts

## Why It Matters

DeFi researchers often jump between dashboards, route tools, social feeds, and news sources. Sentinel Alpha turns that fragmented workflow into a traceable multi-agent packet. Missing sources are shown as `not_configured`, `unavailable`, `error`, or `insufficient evidence` instead of being replaced with fake metrics.

## Architecture

```text
Dashboard / CLI
     |
     v
Live Data Preflight
  DexScreener
  Jupiter
  optional Helius
  optional Birdeye
  RSS / optional news APIs
  Reddit / optional social APIs
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

## Dashboard

The dashboard is a visual layer over the same source clients and workflow used by the CLI.

It includes:

- landing page with source and architecture overview
- token analysis console
- quick token shortcuts
- progressive agent execution timeline
- evidence dashboard for market, route, news, sentiment, risk, and confidence fields
- token identity panel for the analyzed mint
- recommendation panel with active alerts and monitoring triggers
- trace viewer
- artifact downloads for JSON, Markdown, and evidence reports
- responsive desktop, tablet, and mobile layouts

Dashboard screenshot placeholder:

```text
Add screenshot after running npm run dev and completing a live token analysis.
```

## Data Sources

- DexScreener: Solana token pairs, price fields, liquidity, volume, pair metadata.
- Jupiter: route and quote availability.
- Helius: optional DAS token metadata when `HELIUS_API_KEY` is configured.
- Birdeye: optional token overview when `BIRDEYE_API_KEY` is configured.
- CoinDesk RSS and CoinTelegraph RSS: recent news evidence.
- CryptoPanic, GNews, and NewsAPI: optional news evidence when API keys are configured.
- Reddit and LunarCrush: optional social evidence where available or configured.

External data requests use axios in the shared source-client layer. If a source fails, rate-limits, returns no data, or lacks a key, Sentinel Alpha reports that state.

## File Structure

```text
.
├── app/
│   ├── api/analyze/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── agent-flow.tsx
│   ├── analysis-console.tsx
│   ├── hero.tsx
│   └── query-provider.tsx
├── lib/
│   ├── analyze-client.ts
│   └── tokens.ts
├── scripts/
│   ├── run-swarm.ts
│   ├── validate.ts
│   └── lib/
│       ├── env.ts
│       ├── report.ts
│       ├── source-clients.ts
│       ├── types.ts
│       └── workflow.ts
├── prompts/system.md
├── swarm.payload.json
├── SUBMISSION.md
├── LAUNCH_FORM.md
├── marketplace-listing.md
├── tailwind.config.ts
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
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
LUNARCRUSH_API_KEY=
```

`JUPITER_QUOTE_AMOUNT_BASE_UNITS` controls the route-check quote size. The default for wrapped SOL is `100000000` base units, displayed as `Quote Input: 0.1 SOL equivalent`; it is not a recommended trade size.

## Setup

```bash
cd /Users/mac/Desktop/projects/hackathons/sentinel-alpha
npm install
cp .env.example .env
npm run validate
```

Add `SWARMS_API_KEY` to `.env` before running the full Swarms CLI workflow or using the dashboard `Run Analysis` button. The dashboard intentionally runs the full demo workflow, not preflight-only mode.

## Scripts

Validate submission quality:

```bash
npm run validate
```

Run live-data preflight only:

```bash
npm run preflight -- So11111111111111111111111111111111111111112
```

Run the full live-data + Swarms agent workflow:

```bash
npm run demo -- So11111111111111111111111111111111111111112
```

Run the dashboard:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is busy, Next.js will print the next available local URL, such as `http://localhost:3001` or `http://localhost:3002`.

## Demo Flow For Judges

1. Run `npm install`.
2. Run `cp .env.example .env`.
3. Add `SWARMS_API_KEY` to `.env`.
4. Run `npm run validate`.
5. Run `npm run dev`.
6. Open the local URL printed by Next.js.
7. Select a quick token or paste a Solana token mint.
8. Click `Run Analysis`.
9. Review token identity, source status, agent timeline, evidence cards, recommendation category, risk scenarios, active alerts, monitoring triggers, traces, and artifact downloads.

## Deployment

Sentinel Alpha is prepared for Vercel:

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Add optional environment variables in Vercel project settings.
4. Deploy with the default Next.js build command.

The API route is:

```text
POST /api/analyze
```

Request:

```json
{
  "tokenAddress": "So11111111111111111111111111111111111111112",
  "runSwarms": true
}
```

The dashboard sends `runSwarms: true`, so `SWARMS_API_KEY` is required for interactive dashboard analysis. The route reuses `scripts/lib/workflow.ts`, which reuses the same source clients as the CLI.

## Artifacts

Each CLI or dashboard run can write trace artifacts to `artifacts/runs/`:

- `sentinel-alpha-*.json`: source packet, agent input, and Swarms response when available.
- `sentinel-alpha-*.md`: judge-friendly report.
- `agent-trace-*.json`: ordered agent execution trace.
- `decision-chain-*.json`: confidence chain, risk model, and decision chain.
- `evidence-report-*.md`: source evidence and agent evidence blocks.

## Risk And Alert Model

Active alerts are reserved for conditions observed in the current evidence packet. Monitoring triggers describe future conditions to watch, such as liquidity drawdowns, volume changes, route unavailability, source errors, and news or sentiment gaps.

## Marketplace Publishing

Use [marketplace-listing.md](marketplace-listing.md) and [LAUNCH_FORM.md](LAUNCH_FORM.md) for the Swarms Marketplace listing.

## Disclaimer

Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute transactions, and should not be the sole basis for investment or trading decisions.

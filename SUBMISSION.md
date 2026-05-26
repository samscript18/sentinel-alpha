# Sentinel Alpha — Swarms ACM Hackathon Submission

Sentinel Alpha is an evidence-first Solana DeFi trading research swarm.

It coordinates four specialized agents:

1. Researcher Agent — collects and labels live token, market, route, and optional on-chain intelligence.
2. Analyst Agent — evaluates liquidity, volume, market structure, route availability, and available trading context.
3. Risk Manager Agent — identifies volatility, liquidity, routing, source reliability, and data-completeness risks.
4. Executor/Recommender Agent — produces a structured decision-support report with alerts and illustrative risk scenarios.

## Why It Matters

Solana traders often rely on fragmented dashboards, social feeds, and incomplete market signals. Sentinel Alpha turns live data into a structured multi-agent risk report without fake metrics, hidden assumptions, or direct financial advice.

## Real Data Sources

- DexScreener
- Jupiter
- Optional Helius
- Optional Birdeye
- CoinDesk RSS
- CoinTelegraph RSS
- Optional CryptoPanic
- Optional GNews
- Optional NewsAPI
- Optional Reddit public search
- Optional LunarCrush

DexScreener and Jupiter work without project-specific API keys. Helius and Birdeye are optional premium data layers; if their keys are missing, Sentinel Alpha reports `not_configured` instead of inventing data.

## Output

Each run produces:

- agent execution timeline
- data source status
- research evidence summary
- analyst observations
- risk flags
- confidence score based on data completeness
- optional news and social evidence
- technical indicator status
- risk model
- monitoring triggers
- final recommendation category: `WATCH`, `HIGH RISK`, `AVOID`, `RESEARCH FURTHER`, or `MONITOR CLOSELY`
- financial disclaimer
- JSON, Markdown, agent trace, decision-chain, and evidence-report artifacts under `artifacts/runs/`

## Hackathon Fit

Sentinel Alpha fits Agent Capital Markets because it packages market intelligence as a reusable, tokenizable agent workflow for Swarms Marketplace. It is not a generic prompt wrapper: it performs live-data preflight, preserves source traceability, and routes structured evidence through a real multi-agent workflow.

## Marketplace Angle

Sentinel Alpha can be tokenized as a paid DeFi research swarm. Users can run it repeatedly against Solana token mints to triage market conditions, route availability, and risk signals before doing deeper manual research.

The runtime does not inject prewritten market briefs. Each report is generated from live source responses for the submitted token mint.

## Run

```bash
npm install
cp .env.example .env
npm run validate
npm run preflight -- So11111111111111111111111111111111111111112
npm run demo -- So11111111111111111111111111111111111111112
```

`preflight` verifies live data sources without calling Swarms. `demo` runs the full live-data + Swarms agent workflow and requires `SWARMS_API_KEY`.

## Disclaimer

Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute trades, and should not be used as the sole basis for investment or trading decisions.

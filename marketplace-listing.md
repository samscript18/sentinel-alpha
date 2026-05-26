# Swarms Marketplace Listing

## Name

Sentinel Alpha

## Category

DeFi / Trading / Agent Capital Markets

## Short Description

Evidence-first Solana DeFi trading intelligence swarm with live market-data preflight, risk review, and conservative decision-support categories.

## Problem

Crypto traders and analysts are flooded with dashboards, token chatter, and partial market signals. Basic AI prompts often hallucinate missing metrics or jump straight to trade advice without showing what data was actually available.

## Solution

Sentinel Alpha turns a Solana token address and user context into a structured research packet. It checks live data sources first, records source status, then routes the evidence through four specialized agents:

```text
Researcher Agent -> Analyst Agent -> Risk Manager Agent -> Executor/Recommender Agent
```

The final output is not a buy/sell command. It is a decision-support report with source status, evidence summary, risk flags, confidence score, illustrative exposure scenarios, active alerts, monitoring triggers, and one conservative category: `WATCH`, `HIGH RISK`, `AVOID`, `RESEARCH FURTHER`, or `MONITOR CLOSELY`.

The standalone runner also supports `preflight-only` mode, which lets users test source availability and produce evidence artifacts before paying for a full Swarms run.

The runtime does not inject prewritten market narratives. Reports are based on source data returned for the submitted token mint.

## Target Users

- DeFi traders who want faster research triage
- Solana ecosystem analysts
- Agent capital market participants
- Token teams monitoring market health
- Risk-focused users who want AI analysis without blind trade calls

## Real-World Utility

Sentinel Alpha is useful before a human opens a position, publishes research, monitors a token, or decides whether a market is too thin to evaluate. Its main value is evidence discipline: it shows what data exists, what failed, what is missing, and how that affects confidence.

## Agent Architecture

- Researcher Agent: converts source data into verified evidence and unavailable-data notes.
- Analyst Agent: interprets market structure, route availability, liquidity context, and scenarios.
- Risk Manager Agent: flags data gaps, liquidity risk, event risk, and confidence limits.
- Executor/Recommender Agent: synthesizes the final decision-support report.

## Data Sources

- DexScreener: token pairs, liquidity, volume, price fields, pair metadata.
- Jupiter: route and quote availability.
- Helius: optional DAS token metadata when `HELIUS_API_KEY` is configured.
- Birdeye: optional token overview when `BIRDEYE_API_KEY` is configured.
- CoinDesk RSS and CoinTelegraph RSS: recent news evidence.
- CryptoPanic, GNews, NewsAPI: optional API-key news layers.
- Reddit and LunarCrush: optional social evidence layers.

Missing keys or failed APIs are reported explicitly. Sentinel Alpha does not fake unavailable market data.

## Traceability

Every run can produce JSON, Markdown, agent-trace, decision-chain, and evidence-report artifacts containing the live source packet, source status rows, data-completeness score, pre-agent confidence category, agent timeline, risk model, active alerts, monitoring triggers, and final decision-support output.

## Frenzy Mode / Tokenization Angle

Sentinel Alpha is a tokenized research swarm for Agent Capital Markets. Frenzy Mode makes it easy for users to discover, buy, and repeatedly run a specialized DeFi intelligence workflow instead of a generic one-shot prompt.

## Why It Belongs On Swarms Marketplace

Swarms Marketplace is strongest when agents are specialized, reusable, and economically useful. Sentinel Alpha fits that pattern: it is a focused trading research product with live data preflight, visible agent handoffs, and a final output that is easy to evaluate.

## Suggested Pricing / Monetization

- Low-cost per run for retail research triage.
- Higher-priced premium version with Helius and Birdeye keys configured.
- Subscription bundle for daily token monitoring and watchlist review.
- Team license for analysts or token communities.

## Best Prompt To Demo

```text
Analyze this Solana token for a 1 to 7 day research view. I am not currently positioned and do not want financial advice. Focus on data availability, liquidity, route availability, risk flags, and monitoring triggers. If live data is missing, say exactly what is unavailable and classify conservatively.
```

## Expected Output

- Agent execution timeline
- Data source status
- Research evidence summary
- Analyst observations
- Risk flags
- Confidence score
- Active alerts
- Monitoring triggers
- Final recommendation category
- Disclaimer

## Risk Disclaimer

Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute trades, and should not be used as the sole basis for investment or trading decisions.

# Sentinel Alpha Launch Form

Use this as the copy/paste source for the Swarms Marketplace launch flow shown in the screenshots.

## Publish Type

Choose: `Agent`

## Basic Information

Name:

```text
Sentinel Alpha
```

Description:

```text
Evidence-first Solana DeFi trading research swarm for Agent Capital Markets. Sentinel Alpha pulls live market, route, optional on-chain, optional news, and optional social evidence, then routes it through Researcher, Analyst, Risk Manager, and Recommender agents. Outputs are decision-support only: source status, evidence summary, risk flags, confidence, illustrative exposure scenarios, alerts, and one conservative category.
```

Categories:

```text
DeFi
Trading
Analytics
Agents
Research
```

Tags:

```text
defi, trading, solana, agent-capital-markets, risk-analysis, market-intelligence, dexscreener, jupiter, helius, birdeye, news, sentiment, evidence-first
```

Agent Media:

```text
Use a 16:9 image showing a dark Solana market intelligence dashboard with four agent stages: Research, Analysis, Risk, Recommendation. Avoid profit imagery or price target claims.
```

## Agent Implementation

Recommended option:

```text
Import from GitHub
```

Repository URL:

```text
<your public GitHub repository URL for defi-trading-swarm>
```

If using direct code instead:

Programming Language:

```text
typescript
```

Package Requirements:

```text
@types/node
```

Install command:

```bash
npm install
```

Entrypoint:

```bash
npm run demo -- <SOLANA_TOKEN_MINT>
```

Environment Variables:

```text
SWARMS_API_KEY=


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

## Use Cases

Use Case 1 Title:

```text
Solana Token Research Triage
```

Use Case 1 Description:

```text
Run Sentinel Alpha against a Solana token mint to collect live DexScreener liquidity/volume/pair evidence, Jupiter route evidence, optional Helius/Birdeye metadata, and optional news/social context. The output is a conservative decision-support report with Evidence lines for every conclusion.
```

Use Case 2 Title:

```text
Pre-Trade Risk Review
```

Use Case 2 Description:

```text
Use the swarm before manual research or execution to identify liquidity risk, route risk, data completeness gaps, volatility proxy risk, source failures, and monitoring alerts. It does not provide buy/sell advice.
```

Use Case 3 Title:

```text
Agent Capital Markets Monitoring
```

Use Case 3 Description:

```text
Token teams, analysts, and agent-market participants can repeatedly run Sentinel Alpha to produce traceable JSON/Markdown evidence artifacts, decision chains, and agent traces for Solana market monitoring.
```

## Links

GitHub:

```text
https://github.com/samscript18/sentinel-alpha
```


## Pricing

Choose:

```text
Tokenization
```

Ticker Name:

```text
SENALPHA
```

Quote Mint:

```text
SOL — Solana
```

Initial Buy:

```text
Leave empty unless you intentionally want to seed liquidity.
```

Frenzy Mode:

```text
Enable if submitting for the ACM Hackathon Frenzy Mode requirement.
```

## Marketplace Short Description

```text
Evidence-first Solana DeFi research swarm with live market, route, optional on-chain, news, sentiment, risk, alerts, and traceable decision-support outputs.
```

## Safety Disclaimer

```text
Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute trades, does not custody funds, and does not generate price targets.
```

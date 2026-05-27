# Sentinel Alpha Launch Form

Use this as the copy/paste source for the Swarms Marketplace launch flow.

## Publish Type

```text
Agent
```

## Basic Information

Name:

```text
Sentinel Alpha
```

Description:

```text
Evidence-first Solana DeFi trading research swarm for Agent Capital Markets. Sentinel Alpha pulls live market, route, optional on-chain, optional news, and optional social evidence, then routes it through Researcher, Analyst, Risk Manager, and Recommender agents. It includes a responsive dashboard for desktop, tablet, and mobile. Outputs are decision-support only: token identity, source status, evidence summary, risk flags, confidence, illustrative exposure scenarios, active alerts, monitoring triggers, artifacts, and one conservative category.
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

## Agent Implementation

Recommended option:

```text
Import from GitHub
```

Repository URL:

```text
<your public GitHub repository URL for sentinel-alpha>
```

Programming Language:

```text
typescript
```

Package Requirements:

```text
next
react
react-dom
axios
@tanstack/react-query
tailwindcss
typescript
@types/node
@types/react
@types/react-dom
```

Install command:

```bash
npm install
```

Entrypoint:

```bash
npm run demo -- <SOLANA_TOKEN_MINT>
```

Dashboard command:

```bash
npm run dev
```

Dashboard behavior:

```text
The dashboard Run Analysis button executes the full demo workflow through /api/analyze and requires SWARMS_API_KEY. Use npm run preflight from the CLI for source checks that do not call Swarms.
```

Environment Variables:

```text
SWARMS_API_KEY=
HELIUS_API_KEY=
BIRDEYE_API_KEY=
CRYPTOPANIC_API_KEY=
GNEWS_API_KEY=
NEWS_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
LUNARCRUSH_API_KEY=
DEFAULT_SOLANA_TOKEN_ADDRESS=
JUPITER_QUOTE_AMOUNT_BASE_UNITS=100000000
SWARMS_TIMEOUT_MS=200000
```

## Use Cases

Use Case 1:

```text
Solana Token Research Triage
```

```text
Run Sentinel Alpha against a Solana token mint to collect live market, route, optional on-chain, news, and social evidence. The output is a conservative decision-support report with Evidence lines for every conclusion.
```

Use Case 2:

```text
Pre-Trade Risk Review
```

```text
Identify liquidity concerns, route risk, data completeness gaps, volatility proxy risk, source failures, active alerts, and monitoring triggers. Sentinel Alpha does not provide buy or sell advice.
```

Use Case 3:

```text
Agent Capital Markets Monitoring
```

```text
Produce traceable JSON and Markdown evidence artifacts, decision chains, and agent traces for repeated Solana market monitoring.
```

## Links

GitHub:

```text
<your public GitHub repository URL>
```

Docs:

```text
<link to README.md or repository docs>
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
SOL - Solana
```

Initial Buy:

```text
Leave empty unless you intentionally want to seed liquidity.
```

Frenzy Mode:

```text
Enable for the ACM Hackathon Frenzy Mode requirement.
```

## Safety Disclaimer

```text
Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute trades, does not custody funds, and does not generate price targets.
```

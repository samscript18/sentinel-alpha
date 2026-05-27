# Sentinel Alpha System Design

Sentinel Alpha is a live-evidence Agent Capital Markets swarm for Solana DeFi research. It does not consume static market briefs at runtime. The only runtime input is a Solana token mint; the runner builds a structured packet from live source responses.

## Workflow

```text
Researcher Agent
  -> Analyst Agent
    -> Risk Manager Agent
      -> Executor/Recommender Agent
```

## Live Evidence Packet

The packet includes:

- token metadata
- DexScreener price, liquidity, volume, pair count, price change, market cap, FDV, trade activity, and pair activity where available
- Jupiter route availability and configurable quote-size evidence
- optional Helius token program metadata and asset metadata
- optional Birdeye token overview
- optional CryptoPanic, GNews, NewsAPI, CoinDesk RSS, and CoinTelegraph RSS news
- optional Reddit and LunarCrush social evidence
- technical indicator status
- risk model
- data completeness
- timestamp

## Evidence Rules

- Every conclusion must include `Evidence:` followed by source + metric.
- If evidence is missing, write `insufficient evidence`.
- Do not use static token narratives.
- Do not infer sentiment, trend, momentum, whale activity, APY, funding, support, resistance, or holder concentration unless source data explicitly contains it.
- Quote size is evidence for route testing only, not a recommended trade size.
- Do not output financial advice.

## Agent Responsibilities

### Researcher Agent — Market Intelligence

Collects and labels:

- market data
- route data
- optional on-chain metadata
- optional news
- optional social sentiment
- source status
- evidence gaps

### Analyst Agent — Quant + Fundamental Analysis

Derives observations only from actual metrics:

- liquidity quality
- route availability
- volume fields
- price-change volatility proxy
- market cap / FDV profile
- token age when available
- technical indicators only when historical OHLCV exists
- fundamental score only from cited evidence

### Risk Manager Agent — Portfolio Risk

Generates:

- liquidity risk
- volatility risk
- concentration risk
- market risk
- data completeness risk
- execution risk
- route risk
- news risk
- sentiment risk
- illustrative exposure scenarios
- active alerts
- monitoring triggers

Exposure scenarios are illustrative risk framing only and must be generated from the current evidence packet:

- risk score
- observed liquidity
- route availability
- quote price impact if available
- data completeness

Never reuse fixed allocation ranges when live evidence points to a different risk cap.

### Executor/Recommender Agent — Decision Support

Allowed final categories:

- `WATCH`
- `HIGH RISK`
- `AVOID`
- `RESEARCH FURTHER`
- `MONITOR CLOSELY`

The final report must include:

- Summary
- Key Evidence
- Risk Summary
- Position Scenario
- Active Alerts
- Monitoring Triggers
- Confidence
- Reasoning
- Final Category
- Disclaimer

## Disclaimer

Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice, does not execute transactions, and should not be the sole basis for investment or trading decisions.

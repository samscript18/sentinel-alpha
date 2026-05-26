import type {
  DataCompleteness,
  DexScreenerPair,
  JupiterRouteEvidence,
  NewsEvidence,
  NewsItem,
  SourceName,
  SourcePacket,
  SourceResult,
  TechnicalIndicators,
  RiskModel,
  SentimentEvidence
} from "./types.ts";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function buildSourcePacket(tokenAddress: string): Promise<SourcePacket> {
  const [dexScreener, jupiter, helius, birdeye] = await Promise.all([
    fetchDexScreener(tokenAddress),
    fetchJupiterRoute(tokenAddress),
    fetchHeliusAsset(tokenAddress),
    fetchBirdeyeOverview(tokenAddress)
  ]);

  const queryTerms = buildQueryTerms(tokenAddress, dexScreener.data, helius.data);
  const [coinDesk, coinTelegraph, cryptoPanic, gNews, newsApi, reddit, lunarCrush] = await Promise.all([
    fetchRssNews("CoinDeskRSS", "https://www.coindesk.com/arc/outboundfeeds/rss/", queryTerms),
    fetchRssNews("CoinTelegraphRSS", "https://cointelegraph.com/rss", queryTerms),
    fetchCryptoPanic(queryTerms),
    fetchGNews(queryTerms),
    fetchNewsApi(queryTerms),
    fetchRedditSentiment(queryTerms),
    fetchLunarCrush(queryTerms)
  ]);

  const news = mergeNews([coinDesk, coinTelegraph, cryptoPanic, gNews, newsApi]);
  const sentiment = mergeSentiment([reddit, lunarCrush]);
  const technicalIndicators = buildTechnicalIndicators(birdeye.data);
  const riskModel = buildRiskModel({ dexScreener, jupiter, helius, birdeye, sentiment, technicalIndicators });

  const allResults = [
    dexScreener,
    jupiter,
    helius,
    birdeye,
    coinDesk,
    coinTelegraph,
    cryptoPanic,
    gNews,
    newsApi,
    reddit,
    lunarCrush
  ];

  const status = allResults.map(({ source, status, message }) => ({
    source,
    status,
    message
  }));

  const evidence = {
    dexScreener: dexScreener.data,
    jupiter: jupiter.data,
    helius: helius.data,
    birdeye: birdeye.data,
    news,
    sentiment,
    technicalIndicators,
    riskModel
  };

  const completeness = scoreCompleteness(allResults);

  return { status, evidence, completeness };
}

async function fetchDexScreener(tokenAddress: string): Promise<SourceResult<{ pairs: DexScreenerPair[] }>> {
  const source = "DexScreener";
  const url = `https://api.dexscreener.com/token-pairs/v1/solana/${tokenAddress}`;

  try {
    const response = await fetchJson(url, {}, 20000);
    if (!Array.isArray(response) || response.length === 0) {
      return unavailable(source, "No Solana pairs returned for token address.", { pairs: [] });
    }

    const pairs = response
      .filter((pair: Record<string, unknown>) => pair?.chainId === "solana")
      .sort((a: any, b: any) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0))
      .slice(0, 5)
      .map((pair: any) => ({
        dexId: pair.dexId ?? null,
        pairAddress: pair.pairAddress ?? null,
        url: pair.url ?? null,
        baseToken: pair.baseToken ?? null,
        quoteToken: pair.quoteToken ?? null,
        priceUsd: pair.priceUsd ?? null,
        liquidityUsd: pair.liquidity?.usd ?? null,
        volume: pair.volume ?? null,
        priceChange: pair.priceChange ?? null,
        txns: pair.txns ?? null,
        fdv: pair.fdv ?? null,
        marketCap: pair.marketCap ?? null,
        pairCreatedAt: pair.pairCreatedAt ?? null
      }));

    if (pairs.length === 0) {
      return unavailable(source, "DexScreener responded, but no Solana pairs survived filtering.", { pairs: [] });
    }

    return available(source, `Retrieved ${pairs.length} Solana pair(s).`, { pairs });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchJupiterRoute(tokenAddress: string): Promise<SourceResult<JupiterRouteEvidence>> {
  const source = "Jupiter";
  const inputMint = tokenAddress === USDC_MINT ? SOL_MINT : tokenAddress;
  const outputMint = USDC_MINT;
  const amount = process.env.JUPITER_QUOTE_AMOUNT_BASE_UNITS ?? (inputMint === SOL_MINT ? "100000000" : "1000000");
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: "50",
    restrictIntermediateTokens: "true"
  });

  try {
    const response = await fetchJson(`https://lite-api.jup.ag/swap/v1/quote?${params}`, {}, 20000);
    if (response?.error) {
      return unavailable(source, String(response.error), null);
    }

    return available(source, "Route/quote availability checked.", {
      inputMint: response.inputMint ?? inputMint,
      outputMint: response.outputMint ?? outputMint,
      quoteInputLabel: quoteInputLabel(inputMint, amount),
      quoteAmountBaseUnits: amount,
      inAmount: response.inAmount ?? null,
      outAmount: response.outAmount ?? null,
      priceImpactPct: response.priceImpactPct ?? null,
      routeLabels: Array.isArray(response.routePlan)
        ? response.routePlan.map((route: any) => route?.swapInfo?.label).filter(Boolean)
        : [],
      contextSlot: response.contextSlot ?? null,
      timeTaken: response.timeTaken ?? null
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchRssNews(
  source: "CoinDeskRSS" | "CoinTelegraphRSS",
  url: string,
  queryTerms: string[]
): Promise<SourceResult<NewsEvidence>> {
  try {
    const text = await fetchText(url, {}, 20000);
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((match) => parseRssItem(match[1], source, queryTerms))
      .filter((item): item is NewsItem => Boolean(item))
      .filter((item) => item.ageHours === null || item.ageHours <= 72)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);

    return available(source, `Retrieved ${items.length} relevant recent RSS item(s).`, {
      items,
      windowHours: 72
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchCryptoPanic(queryTerms: string[]): Promise<SourceResult<NewsEvidence>> {
  const source = "CryptoPanic";
  if (!process.env.CRYPTOPANIC_API_KEY) {
    return notConfigured(source, "CRYPTOPANIC_API_KEY not configured.");
  }

  const currencies = queryTerms.find((term) => /^[A-Z0-9]{2,10}$/.test(term)) ?? "";
  const params = new URLSearchParams({
    auth_token: process.env.CRYPTOPANIC_API_KEY,
    public: "true"
  });
  if (currencies) params.set("currencies", currencies);

  try {
    const response = await fetchJson(`https://cryptopanic.com/api/v1/posts/?${params}`, {}, 20000);
    const items = Array.isArray(response?.results)
      ? response.results.map((item: any) => ({
          headline: String(item.title ?? ""),
          source: String(item.source?.title ?? source),
          publishedAt: item.published_at ?? null,
          ageHours: ageHours(item.published_at),
          relevance: relevanceScore(String(item.title ?? ""), queryTerms),
          url: item.url ?? null,
          sentiment: item.votes ?? null
        }))
      : [];
    return available(source, `Retrieved ${items.length} CryptoPanic item(s).`, {
      items: dedupeNews(items).slice(0, 10),
      windowHours: 72
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchGNews(queryTerms: string[]): Promise<SourceResult<NewsEvidence>> {
  const source = "GNews";
  if (!process.env.GNEWS_API_KEY) {
    return notConfigured(source, "GNEWS_API_KEY not configured.");
  }

  const params = new URLSearchParams({
    q: queryTerms.slice(0, 3).join(" OR "),
    lang: "en",
    max: "10",
    apikey: process.env.GNEWS_API_KEY
  });

  try {
    const response = await fetchJson(`https://gnews.io/api/v4/search?${params}`, {}, 20000);
    const items = Array.isArray(response?.articles)
      ? response.articles.map((item: any) => ({
          headline: String(item.title ?? ""),
          source: String(item.source?.name ?? source),
          publishedAt: item.publishedAt ?? null,
          ageHours: ageHours(item.publishedAt),
          relevance: relevanceScore(String(item.title ?? ""), queryTerms),
          url: item.url ?? null,
          sentiment: null
        }))
      : [];
    return available(source, `Retrieved ${items.length} GNews item(s).`, {
      items: dedupeNews(items).slice(0, 10),
      windowHours: 72
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchNewsApi(queryTerms: string[]): Promise<SourceResult<NewsEvidence>> {
  const source = "NewsAPI";
  if (!process.env.NEWS_API_KEY) {
    return notConfigured(source, "NEWS_API_KEY not configured.");
  }

  const params = new URLSearchParams({
    q: queryTerms.slice(0, 3).join(" OR "),
    language: "en",
    pageSize: "10",
    apiKey: process.env.NEWS_API_KEY
  });

  try {
    const response = await fetchJson(`https://newsapi.org/v2/everything?${params}`, {}, 20000);
    const items = Array.isArray(response?.articles)
      ? response.articles.map((item: any) => ({
          headline: String(item.title ?? ""),
          source: String(item.source?.name ?? source),
          publishedAt: item.publishedAt ?? null,
          ageHours: ageHours(item.publishedAt),
          relevance: relevanceScore(String(item.title ?? ""), queryTerms),
          url: item.url ?? null,
          sentiment: null
        }))
      : [];
    return available(source, `Retrieved ${items.length} NewsAPI item(s).`, {
      items: dedupeNews(items).slice(0, 10),
      windowHours: 72
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchRedditSentiment(queryTerms: string[]): Promise<SourceResult<SentimentEvidence>> {
  const source = "Reddit";
  const params = new URLSearchParams({
    q: queryTerms.slice(0, 3).join(" "),
    sort: "new",
    t: "day",
    limit: "25"
  });

  try {
    const response = await fetchJson(`https://www.reddit.com/search.json?${params}`, {
      headers: { "User-Agent": "sentinel-alpha-hackathon/1.0" }
    }, 20000);
    const posts = Array.isArray(response?.data?.children) ? response.data.children : [];
    const engagementVelocity = posts.reduce((sum: number, item: any) => sum + Number(item?.data?.score ?? 0), 0);
    return available(source, `Retrieved ${posts.length} Reddit mention(s) from public search.`, {
      score: null,
      confidence: "low",
      socialVelocity: posts.length,
      positiveSignalCount: null,
      negativeSignalCount: null,
      engagementVelocity,
      communityGrowth: null,
      socialDominance: null,
      fearGreed: null,
      notes: ["Reddit public search provides mention and engagement counts only; sentiment polarity is insufficient evidence."]
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchLunarCrush(queryTerms: string[]): Promise<SourceResult<SentimentEvidence>> {
  const source = "LunarCrush";
  if (!process.env.LUNARCRUSH_API_KEY) {
    return notConfigured(source, "LUNARCRUSH_API_KEY not configured.");
  }

  try {
    return unavailable(source, "LunarCrush API key configured, but no project endpoint is wired for this submission.", {
      score: null,
      confidence: "none",
      socialVelocity: null,
      positiveSignalCount: null,
      negativeSignalCount: null,
      engagementVelocity: null,
      communityGrowth: null,
      socialDominance: null,
      fearGreed: null,
      notes: ["insufficient evidence"]
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchHeliusAsset(tokenAddress: string): Promise<SourceResult> {
  const source = "Helius";
  if (!process.env.HELIUS_API_KEY) {
    return notConfigured(source, "HELIUS_API_KEY not configured.");
  }

  try {
    const response = await fetchJson(
      `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "sentinel-alpha",
          method: "getAsset",
          params: {
            id: tokenAddress,
            options: {
              showFungible: true
            }
          }
        })
      },
      20000
    );

    if (response?.error) {
      return unavailable(source, response.error.message ?? "Helius returned an error.", response.error);
    }

    const asset = response?.result;
    return available(source, "DAS getAsset returned token metadata.", {
      id: asset?.id ?? tokenAddress,
      interface: asset?.interface ?? null,
      contentMetadata: asset?.content?.metadata ?? null,
      tokenInfo: asset?.token_info ?? null,
      lastIndexedSlot: asset?.last_indexed_slot ?? null
    });
  } catch (error) {
    return errored(source, error);
  }
}

async function fetchBirdeyeOverview(tokenAddress: string): Promise<SourceResult> {
  const source = "Birdeye";
  if (!process.env.BIRDEYE_API_KEY) {
    return notConfigured(source, "BIRDEYE_API_KEY not configured.");
  }

  const url = `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`;

  try {
    const response = await fetchJson(
      url,
      {
        headers: {
          "X-API-KEY": process.env.BIRDEYE_API_KEY,
          "x-chain": "solana",
          accept: "application/json"
        }
      },
      20000
    );

    if (response?.success === false) {
      return unavailable(source, response?.message ?? "Birdeye returned unsuccessful response.", response);
    }

    return available(source, "Token overview returned.", response?.data ?? response);
  } catch (error) {
    return errored(source, error);
  }
}

function scoreCompleteness(results: SourceResult[]): DataCompleteness {
  const availableSources = results.filter((entry) => entry.status === "available").length;
  const dexAvailable = results.some((entry) => entry.source === "DexScreener" && entry.status === "available");
  const jupiterAvailable = results.some((entry) => entry.source === "Jupiter" && entry.status === "available");
  const score = Number((availableSources / results.length).toFixed(2));
  const confidenceScore = Math.round(
    Math.min(95, score * 70 + (dexAvailable ? 10 : 0) + (jupiterAvailable ? 10 : 0))
  );

  let recommendationCategory: DataCompleteness["recommendationCategory"] = "Research Further";
  if (confidenceScore < 60 || score < 0.6) {
    recommendationCategory = "Monitor Closely";
  } else if (!dexAvailable && !jupiterAvailable) {
    recommendationCategory = "Avoid";
  } else if (score < 0.75) {
    recommendationCategory = "Watch";
  } else {
    recommendationCategory = "Monitor Closely";
  }

  return {
    availableSources,
    totalSources: results.length,
    score,
    label: score >= 0.75 ? "strong" : score >= 0.5 ? "partial" : "thin",
    confidenceScore,
    confidenceRationale:
      "Confidence is based on source availability only, not expected price direction or trade profitability.",
    recommendationCategory
  };
}

async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<any> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  const text = await response.text();

  if (response.status === 429) {
    throw new Error(`Rate limited by ${new URL(url).hostname}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return JSON.parse(text);
}

async function fetchText(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<string> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function available<T>(source: SourceName, message: string, data: T): SourceResult<T> {
  return { source, status: "available", message, data };
}

function unavailable<T>(source: SourceName, message: string, data: T | null): SourceResult<T> {
  return { source, status: "unavailable", message, data };
}

function notConfigured(source: SourceName, message: string): SourceResult {
  return { source, status: "not_configured", message, data: null };
}

function errored(source: SourceName, error: unknown): SourceResult {
  const message = error instanceof Error ? error.message : String(error);
  return { source, status: "error", message, data: null };
}

function quoteInputLabel(inputMint: string, amount: string): string {
  if (inputMint === SOL_MINT) {
    const sol = Number(amount) / 1_000_000_000;
    return `Quote Input: ${Number.isFinite(sol) ? sol : "unknown"} SOL equivalent (${amount} base units)`;
  }
  return `Quote Input: ${amount} token base units`;
}

function buildQueryTerms(tokenAddress: string, dexData: { pairs: DexScreenerPair[] } | null, heliusData: unknown): string[] {
  const primary = dexData?.pairs?.[0];
  const base: any = primary?.baseToken;
  const helius: any = heliusData;
  const candidates = [
    tokenAddress,
    base?.symbol,
    base?.name,
    helius?.tokenInfo?.symbol,
    helius?.contentMetadata?.symbol,
    helius?.contentMetadata?.name
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 1)
    .map((value) => value.trim());

  return [...new Set(candidates)].slice(0, 6);
}

function parseRssItem(xml: string, source: SourceName, queryTerms: string[]): NewsItem | null {
  const headline = decodeXml(extractTag(xml, "title") ?? "");
  if (!headline) return null;
  const publishedAt = extractTag(xml, "pubDate") ?? extractTag(xml, "dc:date");
  const itemAge = ageHours(publishedAt);
  const relevance = relevanceScore(headline, queryTerms);
  if (relevance === 0) return null;
  return {
    headline,
    source,
    publishedAt: publishedAt ?? null,
    ageHours: itemAge,
    relevance,
    url: decodeXml(extractTag(xml, "link") ?? "") || null,
    sentiment: null
  };
}

function extractTag(xml: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").trim() ?? null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function ageHours(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Number(((Date.now() - timestamp) / 36e5).toFixed(2));
}

function relevanceScore(text: string, queryTerms: string[]): number {
  const lower = text.toLowerCase();
  return queryTerms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => item.ageHours === null || item.ageHours <= 72)
    .filter((item) => {
      const key = item.headline.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.relevance - a.relevance);
}

function mergeNews(results: SourceResult<NewsEvidence>[]): NewsEvidence {
  return {
    items: dedupeNews(results.flatMap((result) => result.data?.items ?? [])).slice(0, 12),
    windowHours: 72
  };
}

function mergeSentiment(results: SourceResult<SentimentEvidence>[]): SentimentEvidence {
  const available = results.find((result) => result.status === "available" && result.data)?.data;
  if (available) return available;
  return {
    score: null,
    confidence: "none",
    socialVelocity: null,
    positiveSignalCount: null,
    negativeSignalCount: null,
    engagementVelocity: null,
    communityGrowth: null,
    socialDominance: null,
    fearGreed: null,
    notes: ["insufficient evidence"]
  };
}

function buildTechnicalIndicators(birdeyeData: unknown): TechnicalIndicators {
  const data: any = birdeyeData;
  const candles = Array.isArray(data?.ohlcv) ? data.ohlcv : null;
  if (!candles || candles.length < 50) {
    return {
      rsi: null,
      ema20: null,
      ema50: null,
      sma20: null,
      macd: null,
      atr: null,
      trendDirection: "insufficient evidence",
      supportLevels: [],
      resistanceLevels: [],
      evidenceStatus: "insufficient evidence",
      reason: "Historical OHLCV candles are not available in configured sources."
    };
  }

  return {
    rsi: null,
    ema20: null,
    ema50: null,
    sma20: null,
    macd: null,
    atr: null,
    trendDirection: "insufficient evidence",
    supportLevels: [],
    resistanceLevels: [],
    evidenceStatus: "insufficient evidence",
    reason: "OHLCV parsing is not enabled for this source payload."
  };
}

function buildRiskModel(params: {
  dexScreener: SourceResult<{ pairs: DexScreenerPair[] }>;
  jupiter: SourceResult<JupiterRouteEvidence>;
  helius: SourceResult;
  birdeye: SourceResult;
  sentiment: SentimentEvidence;
  technicalIndicators: TechnicalIndicators;
}): RiskModel {
  const primaryPair = params.dexScreener.data?.pairs?.[0];
  const dimensions: RiskModel["dimensions"] = [];

  if (primaryPair?.liquidityUsd !== null && primaryPair?.liquidityUsd !== undefined) {
    dimensions.push({
      name: "Liquidity Risk",
      status: "observed",
      evidence: `DexScreener liquidityUsd=${primaryPair.liquidityUsd}`,
      interpretation:
        "Current observed liquidity reduces immediate liquidity concerns, but should be monitored for drawdowns and venue fragmentation."
    });
  } else {
    dimensions.push({
      name: "Liquidity Risk",
      status: "insufficient evidence",
      evidence: "insufficient evidence",
      interpretation: "insufficient evidence"
    });
  }

  dimensions.push({
    name: "Route Risk",
    status: "observed",
    evidence: `Jupiter status=${params.jupiter.status}`,
    interpretation:
      params.jupiter.status === "available"
        ? "Route is currently available in the observed quote check; monitor for route failures."
        : "Route availability is not confirmed."
  });

  dimensions.push({
    name: "Data Completeness Risk",
    status: "observed",
    evidence: `Helius=${params.helius.status}; Birdeye=${params.birdeye.status}`,
    interpretation: "Coverage depends on configured premium sources; missing providers limit confidence."
  });

  if (primaryPair?.priceChange) {
    dimensions.push({
      name: "Volatility Proxy Risk",
      status: "observed",
      evidence: `DexScreener priceChange=${JSON.stringify(primaryPair.priceChange)}`,
      interpretation: "Price-change fields are a volatility proxy, not a full technical volatility model."
    });
  } else {
    dimensions.push({
      name: "Volatility Proxy Risk",
      status: "insufficient evidence",
      evidence: "insufficient evidence",
      interpretation: "insufficient evidence"
    });
  }

  const insufficient = dimensions.filter((item) => item.status === "insufficient evidence").length;
  const unavailableRoute = params.jupiter.status !== "available" ? 1 : 0;
  const missingPremium = [params.helius, params.birdeye].filter((item) => item.status !== "available").length;
  const riskScore = Math.min(100, insufficient * 25 + unavailableRoute * 25 + missingPremium * 10 + 10);

  return {
    riskScore,
    confidence: Math.max(0, 100 - riskScore),
    dimensions,
    illustrativePositionScenarios: {
      conservative: "1-2% illustrative exposure scenario",
      balanced: "3-5% illustrative exposure scenario",
      aggressive: "5-8% illustrative exposure scenario",
      disclaimer: "Illustrative portfolio exposure scenarios only; not financial advice."
    },
    activeAlerts: [],
    monitoringTriggers: [
      {
        title: "Liquidity Drawdown Alert",
        trigger: "liquidity drops by at least 20% from current observed source field",
        severityIfTriggered: "medium",
        evidence: primaryPair?.liquidityUsd ? `DexScreener liquidityUsd=${primaryPair.liquidityUsd}` : "insufficient evidence"
      },
      {
        title: "Volume Change Alert",
        trigger: "volume changes by at least 25% from current observed source field",
        severityIfTriggered: "medium",
        evidence: primaryPair?.volume ? `DexScreener volume=${JSON.stringify(primaryPair.volume)}` : "insufficient evidence"
      },
      {
        title: "Route Unavailable Alert",
        trigger: "Jupiter route status becomes unavailable or errors",
        severityIfTriggered: "high",
        evidence: `Jupiter status=${params.jupiter.status}`
      },
      {
        title: "News Or Sentiment Gap Alert",
        trigger: "news or sentiment providers remain not configured or return errors",
        severityIfTriggered: "medium",
        evidence: params.sentiment.confidence === "none" ? "insufficient evidence" : `sentimentConfidence=${params.sentiment.confidence}`
      }
    ]
  };
}

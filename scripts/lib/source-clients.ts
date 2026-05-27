import axios, { type AxiosRequestConfig } from "axios";
import type {
  DataCompleteness,
  DexScreenerPair,
  JupiterRouteEvidence,
  NewsEvidence,
  NewsItem,
  SourceName,
  SourcePacket,
  SourceResult,
  SourceStatus,
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

  const completeness = scoreCompleteness(allResults, riskModel);

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
      return unavailable<JupiterRouteEvidence>(source, String(response.error), null);
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
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    return notConfigured(source, "REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET not configured.");
  }

  const params = new URLSearchParams({
    q: queryTerms.slice(0, 3).join(" "),
    sort: "new",
    t: "day",
    limit: "25"
  });

  try {
    const accessToken = await fetchRedditAccessToken();
    const response = await fetchJson(`https://oauth.reddit.com/search?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "sentinel-alpha-hackathon/1.0"
      }
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
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("HTTP 401") || message.includes("HTTP 403")) {
      return unavailable(source, "Reddit OAuth request was rejected; check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.", {
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
    }
    return errored(source, error);
  }
}

async function fetchRedditAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const response = await fetchJson(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "sentinel-alpha-hackathon/1.0"
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString()
    },
    20000
  );

  if (typeof response?.access_token !== "string") {
    throw new Error("Reddit OAuth response did not include access_token.");
  }

  return response.access_token;
}

async function fetchLunarCrush(queryTerms: string[]): Promise<SourceResult<SentimentEvidence>> {
  const source = "LunarCrush";
  if (!process.env.LUNARCRUSH_API_KEY) {
    return notConfigured(source, "LUNARCRUSH_API_KEY not configured.");
  }

  const symbol = queryTerms.find((term) => /^[A-Za-z0-9]{2,12}$/.test(term)) ?? null;
  if (!symbol) {
    return unavailable(source, "No token symbol available for LunarCrush coin lookup.", {
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
  }

  try {
    const response = await fetchJson(
      `https://lunarcrush.com/api4/public/coins/${encodeURIComponent(symbol.toLowerCase())}/v1`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LUNARCRUSH_API_KEY}`,
          accept: "application/json"
        }
      },
      20000
    );
    const metrics = normalizeLunarCrushCoinResponse(response);

    if (!metrics) {
      return unavailable(source, `No LunarCrush coin metrics found for symbol ${symbol}.`, {
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
    }

    return available(source, `Retrieved LunarCrush social metrics for ${symbol}.`, metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("HTTP 402")) {
      return unavailable(source, "LunarCrush API key is configured, but the active plan does not allow this endpoint.", {
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
    }
    return errored(source, error);
  }
}

function normalizeLunarCrushCoinResponse(response: unknown): SentimentEvidence | null {
  const payload: any = response;
  const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data ?? payload;
  if (!data || typeof data !== "object") return null;

  const sentiment = parseNullableNumber(data.sentiment);
  const socialVelocity = parseNullableNumber(data.posts_active ?? data.posts_created ?? data.social_mentions);
  const interactions = parseNullableNumber(data.interactions ?? data.social_interactions);
  const contributors = parseNullableNumber(data.contributors_active ?? data.social_contributors);
  const socialDominance = parseNullableNumber(data.social_dominance);
  const galaxyScore = parseNullableNumber(data.galaxy_score);
  const altRank = parseNullableNumber(data.alt_rank);

  if (
    sentiment === null &&
    socialVelocity === null &&
    interactions === null &&
    contributors === null &&
    socialDominance === null &&
    galaxyScore === null &&
    altRank === null
  ) {
    return null;
  }

  return {
    score: sentiment,
    confidence: sentiment !== null || socialVelocity !== null || interactions !== null ? "medium" : "low",
    socialVelocity,
    positiveSignalCount: null,
    negativeSignalCount: null,
    engagementVelocity: interactions,
    communityGrowth: contributors,
    socialDominance,
    fearGreed: galaxyScore,
    notes: [
      `LunarCrush galaxy_score=${galaxyScore ?? "insufficient evidence"}`,
      `LunarCrush alt_rank=${altRank ?? "insufficient evidence"}`
    ]
  };
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

function scoreCompleteness(results: SourceResult[], riskModel: RiskModel): DataCompleteness {
  const availableSources = results.filter((entry) => entry.status === "available").length;
  const dexAvailable = results.some((entry) => entry.source === "DexScreener" && entry.status === "available");
  const jupiterAvailable = results.some((entry) => entry.source === "Jupiter" && entry.status === "available");
  const configuredSources = results.filter((entry) => entry.status !== "not_configured").length;
  const erroredSources = results.filter((entry) => entry.status === "error").length;
  const score = Number((availableSources / results.length).toFixed(2));
  const confidenceScore = Math.round(
    Math.max(
      0,
      Math.min(95, score * 62 + (dexAvailable ? 12 : 0) + (jupiterAvailable ? 12 : 0) - erroredSources * 4 - riskModel.riskScore * 0.08)
    )
  );

  let recommendationCategory: DataCompleteness["recommendationCategory"] = "Research Further";
  if (!dexAvailable && !jupiterAvailable) {
    recommendationCategory = "Avoid";
  } else if (riskModel.riskScore >= 80) {
    recommendationCategory = "High Risk";
  } else if (confidenceScore < 60 || score < 0.6) {
    recommendationCategory = "Monitor Closely";
  } else if (riskModel.riskScore >= 55 || score < 0.75) {
    recommendationCategory = "Watch";
  } else {
    recommendationCategory = "Research Further";
  }

  return {
    availableSources,
    totalSources: results.length,
    score,
    label: score >= 0.75 ? "strong" : score >= 0.5 ? "partial" : "thin",
    confidenceScore,
    confidenceRationale: `Confidence uses live source availability (${availableSources}/${results.length}), configured source coverage (${configuredSources}/${results.length}), critical DexScreener/Jupiter availability, source errors (${erroredSources}), and riskScore=${riskModel.riskScore}. It is not a price-direction score.`,
    recommendationCategory
  };
}

async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<any> {
  const response = await axios.request({
    ...toAxiosConfig(options),
    url,
    method: (options.method ?? "GET") as AxiosRequestConfig["method"],
    timeout: timeoutMs,
    responseType: "json",
    validateStatus: () => true
  });

  if (response.status === 429) {
    throw new Error(`Rate limited by ${new URL(url).hostname}`);
  }

  if (response.status < 200 || response.status >= 300) {
    const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  return response.data;
}

async function fetchText(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<string> {
  const response = await axios.request({
    ...toAxiosConfig(options),
    url,
    method: (options.method ?? "GET") as AxiosRequestConfig["method"],
    timeout: timeoutMs,
    responseType: "text",
    validateStatus: () => true
  });
  const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
  if (response.status < 200 || response.status >= 300) {
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

function toAxiosConfig(options: RequestInit): AxiosRequestConfig {
  const headers = options.headers ? Object.fromEntries(new Headers(options.headers).entries()) : undefined;
  const data = typeof options.body === "string" ? options.body : undefined;
  return { headers, data };
}

function unavailable<T>(source: SourceName, message: string, data: T | null): SourceResult<T> {
  return { source, status: "unavailable", message, data };
}

function notConfigured<T = unknown>(source: SourceName, message: string): SourceResult<T> {
  return { source, status: "not_configured", message, data: null };
}

function errored<T = unknown>(source: SourceName, error: unknown): SourceResult<T> {
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
  const liquidityUsd = primaryPair?.liquidityUsd ?? null;
  const volume24h = numericField(primaryPair?.volume, "h24");
  const txns24h = sumTxnField(primaryPair?.txns, "h24");
  const maxPriceChange = maxAbsNumericObjectValue(primaryPair?.priceChange);
  const priceImpactPct = parseNullableNumber(params.jupiter.data?.priceImpactPct);
  const pairCount = params.dexScreener.data?.pairs.length ?? 0;
  const liquidityTier = classifyLiquidity(liquidityUsd);
  const volatilityTier = classifyVolatility(maxPriceChange);
  const routeTier = classifyRoute(params.jupiter.status, priceImpactPct);
  const sourceTier = classifySourceCoverage(params.helius.status, params.birdeye.status, params.sentiment.confidence);

  if (liquidityUsd !== null) {
    dimensions.push({
      name: "Liquidity Risk",
      status: "observed",
      evidence: `DexScreener liquidityUsd=${liquidityUsd}; pairCount=${pairCount}`,
      interpretation: liquidityTier.interpretation
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
    evidence: `Jupiter status=${params.jupiter.status}; priceImpactPct=${params.jupiter.data?.priceImpactPct ?? "insufficient evidence"}`,
    interpretation: routeTier.interpretation
  });

  dimensions.push({
    name: "Data Completeness Risk",
    status: "observed",
    evidence: `Helius=${params.helius.status}; Birdeye=${params.birdeye.status}; sentimentConfidence=${params.sentiment.confidence}`,
    interpretation: sourceTier.interpretation
  });

  if (primaryPair?.priceChange && maxPriceChange !== null) {
    dimensions.push({
      name: "Volatility Proxy Risk",
      status: "observed",
      evidence: `DexScreener priceChange=${JSON.stringify(primaryPair.priceChange)}`,
      interpretation: volatilityTier.interpretation
    });
  } else {
    dimensions.push({
      name: "Volatility Proxy Risk",
      status: "insufficient evidence",
      evidence: "insufficient evidence",
      interpretation: "insufficient evidence"
    });
  }

  if (volume24h !== null || txns24h !== null) {
    dimensions.push({
      name: "Activity Risk",
      status: "observed",
      evidence: `DexScreener volume.h24=${volume24h ?? "insufficient evidence"}; txns.h24=${txns24h ?? "insufficient evidence"}`,
      interpretation: activityInterpretation(volume24h, txns24h)
    });
  }

  const insufficientPenalty = dimensions.filter((item) => item.status === "insufficient evidence").length * 12;
  const riskScore = Math.min(
    100,
    Math.round(
      liquidityTier.riskPoints +
        volatilityTier.riskPoints +
        routeTier.riskPoints +
        sourceTier.riskPoints +
        activityRiskPoints(volume24h, txns24h) +
        insufficientPenalty
    )
  );
  const exposureScenarios = buildExposureScenarios(riskScore, liquidityUsd, priceImpactPct);
  const triggers = buildMonitoringTriggers({
    liquidityUsd,
    volume24h,
    maxPriceChange,
    jupiterStatus: params.jupiter.status,
    sentimentConfidence: params.sentiment.confidence,
    priceImpactPct
  });
  const activeAlerts = buildActiveAlerts({ routeTier, liquidityTier, volatilityTier, sourceTier, priceImpactPct });

  return {
    riskScore,
    confidence: Math.max(0, 100 - riskScore),
    dimensions,
    illustrativePositionScenarios: exposureScenarios,
    activeAlerts,
    monitoringTriggers: triggers
  };
}

function classifyLiquidity(liquidityUsd: number | null): { riskPoints: number; interpretation: string; severity: RiskModel["activeAlerts"][number]["severity"] } {
  if (liquidityUsd === null) {
    return { riskPoints: 28, severity: "high", interpretation: "insufficient evidence" };
  }
  if (liquidityUsd < 50_000) {
    return {
      riskPoints: 34,
      severity: "high",
      interpretation: `Observed liquidity is very thin at ${formatUsdCompact(liquidityUsd)}; execution and slippage concerns are elevated.`
    };
  }
  if (liquidityUsd < 250_000) {
    return {
      riskPoints: 24,
      severity: "medium",
      interpretation: `Observed liquidity is shallow at ${formatUsdCompact(liquidityUsd)}; position sizing should be constrained by available depth.`
    };
  }
  if (liquidityUsd < 1_000_000) {
    return {
      riskPoints: 14,
      severity: "medium",
      interpretation: `Observed liquidity is moderate at ${formatUsdCompact(liquidityUsd)}; monitor for drawdowns and fragmented liquidity.`
    };
  }
  return {
    riskPoints: 6,
    severity: "low",
    interpretation: `Observed liquidity is deeper at ${formatUsdCompact(liquidityUsd)}; this lowers immediate liquidity concern but does not remove market or venue risk.`
  };
}

function classifyVolatility(maxPriceChange: number | null): { riskPoints: number; interpretation: string; severity: RiskModel["activeAlerts"][number]["severity"] } {
  if (maxPriceChange === null) {
    return { riskPoints: 18, severity: "medium", interpretation: "insufficient evidence" };
  }
  if (maxPriceChange >= 25) {
    return {
      riskPoints: 30,
      severity: "high",
      interpretation: `DexScreener price-change fields show a maximum absolute move of ${maxPriceChange}%, indicating elevated short-window volatility.`
    };
  }
  if (maxPriceChange >= 10) {
    return {
      riskPoints: 18,
      severity: "medium",
      interpretation: `DexScreener price-change fields show a maximum absolute move of ${maxPriceChange}%, indicating moderate volatility.`
    };
  }
  return {
    riskPoints: 7,
    severity: "low",
    interpretation: `DexScreener price-change fields show a maximum absolute move of ${maxPriceChange}%, indicating lower observed short-window volatility.`
  };
}

function classifyRoute(status: SourceStatus, priceImpactPct: number | null): { riskPoints: number; interpretation: string; severity: RiskModel["activeAlerts"][number]["severity"] } {
  if (status !== "available") {
    return {
      riskPoints: 30,
      severity: "high",
      interpretation: `Jupiter route status is ${status}; route availability is not confirmed.`
    };
  }
  if (priceImpactPct !== null && priceImpactPct > 1) {
    return {
      riskPoints: 22,
      severity: "high",
      interpretation: `Jupiter route is available, but quote priceImpactPct=${priceImpactPct}; execution quality should be monitored.`
    };
  }
  if (priceImpactPct !== null && priceImpactPct > 0.3) {
    return {
      riskPoints: 12,
      severity: "medium",
      interpretation: `Jupiter route is available with priceImpactPct=${priceImpactPct}; execution risk is observable but not absent.`
    };
  }
  return {
    riskPoints: 5,
    severity: "low",
    interpretation: `Jupiter route is available${priceImpactPct !== null ? ` with priceImpactPct=${priceImpactPct}` : ""}.`
  };
}

function classifySourceCoverage(
  heliusStatus: SourceStatus,
  birdeyeStatus: SourceStatus,
  sentimentConfidence: SentimentEvidence["confidence"]
): { riskPoints: number; interpretation: string; severity: RiskModel["activeAlerts"][number]["severity"] } {
  const missing = [heliusStatus, birdeyeStatus].filter((status) => status !== "available").length;
  const sentimentMissing = sentimentConfidence === "none" ? 1 : 0;
  const riskPoints = missing * 7 + sentimentMissing * 8;
  return {
    riskPoints,
    severity: riskPoints >= 18 ? "high" : riskPoints >= 8 ? "medium" : "low",
    interpretation: `Coverage is based on Helius=${heliusStatus}, Birdeye=${birdeyeStatus}, sentimentConfidence=${sentimentConfidence}. Missing configured sources reduce research confidence.`
  };
}

function buildExposureScenarios(
  riskScore: number,
  liquidityUsd: number | null,
  priceImpactPct: number | null
): RiskModel["illustrativePositionScenarios"] {
  const liquidityCap = liquidityUsd === null ? 0.5 : liquidityUsd < 50_000 ? 0.5 : liquidityUsd < 250_000 ? 1 : liquidityUsd < 1_000_000 ? 2 : 3;
  const impactCap = priceImpactPct !== null && priceImpactPct > 1 ? 0.5 : priceImpactPct !== null && priceImpactPct > 0.3 ? 1 : 3;
  const riskCap = riskScore >= 80 ? 0.5 : riskScore >= 60 ? 1 : riskScore >= 40 ? 2 : 4;
  const cap = Math.min(liquidityCap, impactCap, riskCap);
  return {
    conservative: `${formatPercentRange(Math.max(0.1, cap * 0.25), Math.max(0.25, cap * 0.5))} illustrative exposure scenario based on riskScore=${riskScore}`,
    balanced: `${formatPercentRange(Math.max(0.25, cap * 0.5), Math.max(0.5, cap))} illustrative exposure scenario based on observed liquidity/route risk`,
    aggressive: `${formatPercentRange(Math.max(0.5, cap), Math.max(0.75, cap * 1.5))} illustrative exposure scenario; capped by live evidence quality`,
    disclaimer: "Illustrative portfolio exposure scenarios only; not financial advice."
  };
}

function buildMonitoringTriggers(params: {
  liquidityUsd: number | null;
  volume24h: number | null;
  maxPriceChange: number | null;
  jupiterStatus: SourceStatus;
  sentimentConfidence: SentimentEvidence["confidence"];
  priceImpactPct: number | null;
}): RiskModel["monitoringTriggers"] {
  const liquidityDropPct = params.liquidityUsd === null ? null : params.liquidityUsd < 250_000 ? 10 : params.liquidityUsd < 1_000_000 ? 15 : 20;
  const volumeChangePct = params.maxPriceChange !== null && params.maxPriceChange >= 15 ? 35 : params.volume24h !== null && params.volume24h < 100_000 ? 20 : 25;
  const liquidityFloor =
    params.liquidityUsd !== null && liquidityDropPct !== null
      ? Number((params.liquidityUsd * (1 - liquidityDropPct / 100)).toFixed(2))
      : null;
  const volumeLowerBound =
    params.volume24h !== null ? Number((params.volume24h * (1 - volumeChangePct / 100)).toFixed(2)) : null;
  const volumeUpperBound =
    params.volume24h !== null ? Number((params.volume24h * (1 + volumeChangePct / 100)).toFixed(2)) : null;

  return [
    {
      title: "Liquidity Floor Trigger",
      trigger:
        liquidityFloor === null
          ? "liquidity data becomes available for threshold comparison"
          : `observed liquidity falls below ${formatUsdCompact(liquidityFloor)} from current ${formatUsdCompact(params.liquidityUsd!)} baseline`,
      severityIfTriggered: params.liquidityUsd !== null && params.liquidityUsd < 250_000 ? "high" : "medium",
      evidence:
        params.liquidityUsd !== null
          ? `DexScreener liquidityUsd=${params.liquidityUsd}; dynamicDrawdownPct=${liquidityDropPct}; liquidityFloor=${liquidityFloor}`
          : "insufficient evidence"
    },
    {
      title: "Volume Regime Shift Trigger",
      trigger:
        volumeLowerBound === null || volumeUpperBound === null
          ? "24h volume data becomes available for threshold comparison"
          : `24h volume moves outside ${formatUsdCompact(volumeLowerBound)}-${formatUsdCompact(volumeUpperBound)} range from current ${formatUsdCompact(params.volume24h!)} baseline`,
      severityIfTriggered: params.maxPriceChange !== null && params.maxPriceChange >= 15 ? "high" : "medium",
      evidence:
        params.volume24h !== null
          ? `DexScreener volume.h24=${params.volume24h}; dynamicChangePct=${volumeChangePct}; lowerBound=${volumeLowerBound}; upperBound=${volumeUpperBound}`
          : "insufficient evidence"
    },
    {
      title: "Route Quality Alert",
      trigger:
        params.priceImpactPct === null
          ? "Jupiter route becomes unavailable or returns price impact evidence"
          : `Jupiter route becomes unavailable or priceImpactPct rises above ${Math.max(1, Number((params.priceImpactPct * 2).toFixed(2)))}%`,
      severityIfTriggered: params.jupiterStatus === "available" ? "medium" : "high",
      evidence: `Jupiter status=${params.jupiterStatus}; priceImpactPct=${params.priceImpactPct ?? "insufficient evidence"}`
    },
    {
      title: "Sentiment Coverage Alert",
      trigger: params.sentimentConfidence === "none" ? "sentiment source remains unavailable" : "sentiment confidence drops below current observed level",
      severityIfTriggered: params.sentimentConfidence === "none" ? "medium" : "low",
      evidence: params.sentimentConfidence === "none" ? "insufficient evidence" : `sentimentConfidence=${params.sentimentConfidence}`
    }
  ];
}

function buildActiveAlerts(params: {
  routeTier: ReturnType<typeof classifyRoute>;
  liquidityTier: ReturnType<typeof classifyLiquidity>;
  volatilityTier: ReturnType<typeof classifyVolatility>;
  sourceTier: ReturnType<typeof classifySourceCoverage>;
  priceImpactPct: number | null;
}): RiskModel["activeAlerts"] {
  const alerts: RiskModel["activeAlerts"] = [];
  if (params.routeTier.severity === "high") {
    alerts.push({
      title: "Route Risk Active",
      severity: "high",
      evidence: params.priceImpactPct !== null ? `Jupiter priceImpactPct=${params.priceImpactPct}` : "Jupiter route unavailable or insufficient evidence"
    });
  }
  if (params.liquidityTier.severity === "high") {
    alerts.push({
      title: "Thin Liquidity Active",
      severity: "high",
      evidence: params.liquidityTier.interpretation
    });
  }
  if (params.volatilityTier.severity === "high") {
    alerts.push({
      title: "High Volatility Proxy Active",
      severity: "high",
      evidence: params.volatilityTier.interpretation
    });
  }
  if (params.sourceTier.severity === "high") {
    alerts.push({
      title: "Source Coverage Gap Active",
      severity: "medium",
      evidence: params.sourceTier.interpretation
    });
  }
  return alerts;
}

function numericField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>)[key];
  return parseNullableNumber(raw);
}

function sumTxnField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const bucket = (value as Record<string, unknown>)[key];
  if (!bucket || typeof bucket !== "object") return null;
  const buys = parseNullableNumber((bucket as Record<string, unknown>).buys) ?? 0;
  const sells = parseNullableNumber((bucket as Record<string, unknown>).sells) ?? 0;
  return buys + sells;
}

function maxAbsNumericObjectValue(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const numbers = Object.values(value as Record<string, unknown>)
    .map(parseNullableNumber)
    .filter((item): item is number => item !== null)
    .map(Math.abs);
  if (numbers.length === 0) return null;
  return Number(Math.max(...numbers).toFixed(2));
}

function parseNullableNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function activityRiskPoints(volume24h: number | null, txns24h: number | null): number {
  if (volume24h === null && txns24h === null) return 8;
  if ((volume24h !== null && volume24h < 25_000) || (txns24h !== null && txns24h < 50)) return 15;
  if ((volume24h !== null && volume24h < 100_000) || (txns24h !== null && txns24h < 250)) return 8;
  return 3;
}

function activityInterpretation(volume24h: number | null, txns24h: number | null): string {
  if (volume24h === null && txns24h === null) return "insufficient evidence";
  return `Observed activity uses volume.h24=${volume24h ?? "insufficient evidence"} and txns.h24=${txns24h ?? "insufficient evidence"}; lower values increase execution and signal-quality risk.`;
}

function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function formatPercentRange(low: number, high: number): string {
  return `${Number(low.toFixed(2))}-${Number(high.toFixed(2))}%`;
}

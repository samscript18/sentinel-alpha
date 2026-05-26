export type SourceStatus = "available" | "unavailable" | "not_configured" | "error";

export type SourceName =
  | "DexScreener"
  | "Jupiter"
  | "Helius"
  | "Birdeye"
  | "CoinDeskRSS"
  | "CoinTelegraphRSS"
  | "CryptoPanic"
  | "GNews"
  | "NewsAPI"
  | "Reddit"
  | "LunarCrush";

export type SourceResult<T = unknown> = {
  source: SourceName;
  status: SourceStatus;
  message: string;
  data: T | null;
};

export type DataSourceStatusRow = {
  source: SourceName;
  status: SourceStatus;
  message: string;
};

export type DataCompleteness = {
  availableSources: number;
  totalSources: number;
  score: number;
  label: "thin" | "partial" | "strong";
  confidenceScore: number;
  confidenceRationale: string;
  recommendationCategory: "Avoid" | "High Risk" | "Watch" | "Research Further" | "Monitor Closely";
};

export type DexScreenerPair = {
  dexId: string | null;
  pairAddress: string | null;
  url: string | null;
  baseToken: unknown;
  quoteToken: unknown;
  priceUsd: string | null;
  liquidityUsd: number | null;
  volume: unknown;
  priceChange: unknown;
  txns: unknown;
  fdv: number | null;
  marketCap: number | null;
  pairCreatedAt: number | null;
};

export type JupiterRouteEvidence = {
  inputMint: string;
  outputMint: string;
  quoteInputLabel: string;
  quoteAmountBaseUnits: string;
  inAmount: string | null;
  outAmount: string | null;
  priceImpactPct: string | null;
  routeLabels: string[];
  contextSlot: number | null;
  timeTaken: number | null;
};

export type NewsItem = {
  headline: string;
  source: string;
  publishedAt: string | null;
  ageHours: number | null;
  relevance: number;
  url: string | null;
  sentiment: unknown | null;
};

export type NewsEvidence = {
  items: NewsItem[];
  windowHours: number;
};

export type SentimentEvidence = {
  score: number | null;
  confidence: "none" | "low" | "medium" | "high";
  socialVelocity: number | null;
  positiveSignalCount: number | null;
  negativeSignalCount: number | null;
  engagementVelocity: number | null;
  communityGrowth: number | null;
  socialDominance: number | null;
  fearGreed: number | null;
  notes: string[];
};

export type TechnicalIndicators = {
  rsi: number | null;
  ema20: number | null;
  ema50: number | null;
  sma20: number | null;
  macd: number | null;
  atr: number | null;
  trendDirection: string;
  supportLevels: number[];
  resistanceLevels: number[];
  evidenceStatus: "available" | "insufficient evidence";
  reason: string;
};

export type RiskModel = {
  riskScore: number;
  confidence: number;
  dimensions: Array<{
    name: string;
    status: "observed" | "insufficient evidence";
    evidence: string;
    interpretation: string;
  }>;
  illustrativePositionScenarios: {
    conservative: string;
    balanced: string;
    aggressive: string;
    disclaimer: string;
  };
  activeAlerts: Array<{
    title: string;
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
  monitoringTriggers: Array<{
    title: string;
    trigger: string;
    severityIfTriggered: "low" | "medium" | "high";
    evidence: string;
  }>;
};

export type SourceEvidence = {
  dexScreener: { pairs: DexScreenerPair[] } | null;
  jupiter: JupiterRouteEvidence | null;
  helius: unknown | null;
  birdeye: unknown | null;
  news: NewsEvidence;
  sentiment: SentimentEvidence;
  technicalIndicators: TechnicalIndicators;
  riskModel: RiskModel;
};

export type SourcePacket = {
  status: DataSourceStatusRow[];
  evidence: SourceEvidence;
  completeness: DataCompleteness;
};

export type CliArgs = {
  tokenAddress?: string;
  preflightOnly: boolean;
  outputDir: string;
};

export type AgentInput = {
  timestamp: string;
  tokenAddress: string;
  tokenMetadata: {
    dexScreenerBaseToken: unknown | null;
    heliusAssetMetadata: unknown | null;
  };
  dexScreener: {
    price: string | null;
    liquidity: number | null;
    volume: unknown | null;
    pairCount: number;
    priceChange: unknown | null;
    pairs: DexScreenerPair[];
  };
  jupiter: {
    routeAvailable: boolean;
    quoteInfo: JupiterRouteEvidence | null;
  };
  helius: {
    assetMetadata: unknown | null;
  };
  birdeye: {
    tokenOverview: unknown | null;
  };
  news: NewsEvidence;
  sentiment: SentimentEvidence;
  technicalAnalysis: TechnicalIndicators;
  riskModel: RiskModel;
  dataCompleteness: DataCompleteness;
  dataSourceStatus: DataSourceStatusRow[];
  requiredOutput: {
    finalRecommendationCategories: string[];
    include: string[];
  };
};

export type SwarmsPayload = {
  name: string;
  description: string;
  swarm_type: string;
  rearrange_flow?: string;
  task: string;
  agents: Array<Record<string, unknown>>;
  rules: string;
};

export type SwarmsOutputEntry = {
  role: string;
  content: string;
};

export type SwarmsResult = {
  job_id?: string;
  status?: string;
  output?: SwarmsOutputEntry[];
  [key: string]: unknown;
};

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSourcePacket, fetchWithTimeout } from "./source-clients.ts";
import { writeRunArtifacts } from "./report.ts";
import type { AgentInput, SourcePacket, SwarmsPayload, SwarmsResult } from "./types.ts";

const SWARMS_URL = "https://api.swarms.world/v1/swarm/completions";

export type SentinelAnalysisMode = "preflight" | "swarms";

export type SentinelAnalysisResult = {
  sourcePacket: SourcePacket;
  agentInput: AgentInput;
  swarmsResult: SwarmsResult | null;
  artifacts?: {
    jsonPath: string;
    markdownPath: string;
    tracePath: string;
    decisionPath: string;
    evidencePath: string;
  };
};

export async function runSentinelAnalysis(params: {
  tokenAddress: string;
  mode: SentinelAnalysisMode;
  outputDir?: string;
  writeArtifacts?: boolean;
  swarmsApiKey?: string;
  timeoutMs?: number;
  sourcePacket?: SourcePacket;
}): Promise<SentinelAnalysisResult> {
  const sourcePacket = params.sourcePacket ?? (await buildSourcePacket(params.tokenAddress));
  const agentInput = buildAgentInput(params.tokenAddress, sourcePacket);
  let swarmsResult: SwarmsResult | null = null;

  if (params.mode === "swarms") {
    if (!params.swarmsApiKey) {
      throw new Error("SWARMS_API_KEY is not configured. Run preflight mode or configure the key.");
    }

    const payload = await loadSwarmsPayload();
    const requestBody = {
      ...payload,
      task: `${payload.task}\n\nSTRUCTURED AGENT INPUT:\n${JSON.stringify(agentInput, null, 2)}`
    };

    const response = await fetchWithTimeout(
      SWARMS_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": params.swarmsApiKey
        },
        body: JSON.stringify(requestBody)
      },
      params.timeoutMs ?? Number(process.env.SWARMS_TIMEOUT_MS ?? 200000)
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Swarms API error ${response.status}: ${text.slice(0, 1000)}`);
    }
    swarmsResult = parseJsonOrText(text);
  }

  const artifacts = params.writeArtifacts
    ? await writeRunArtifacts({
        outputDir: params.outputDir ?? "artifacts/runs",
        agentInput,
        sourcePacket,
        result: swarmsResult ?? undefined
      })
    : undefined;

  return { sourcePacket, agentInput, swarmsResult, artifacts };
}

export function buildAgentInput(tokenAddress: string, sourcePacket: SourcePacket): AgentInput {
  const pairs = sourcePacket.evidence.dexScreener?.pairs ?? [];
  const primaryPair = pairs[0] ?? null;
  const heliusAsset = sourcePacket.evidence.helius as any;

  return {
    timestamp: new Date().toISOString(),
    tokenAddress,
    tokenMetadata: {
      dexScreenerBaseToken: primaryPair?.baseToken ?? null,
      heliusAssetMetadata: heliusAsset?.contentMetadata ?? heliusAsset ?? null
    },
    dexScreener: {
      price: primaryPair?.priceUsd ?? null,
      liquidity: primaryPair?.liquidityUsd ?? null,
      volume: primaryPair?.volume ?? null,
      pairCount: pairs.length,
      priceChange: primaryPair?.priceChange ?? null,
      pairs
    },
    jupiter: {
      routeAvailable: sourcePacket.status.some((entry) => entry.source === "Jupiter" && entry.status === "available"),
      quoteInfo: sourcePacket.evidence.jupiter
    },
    helius: {
      assetMetadata: sourcePacket.evidence.helius
    },
    birdeye: {
      tokenOverview: sourcePacket.evidence.birdeye
    },
    news: sourcePacket.evidence.news,
    sentiment: sourcePacket.evidence.sentiment,
    technicalAnalysis: sourcePacket.evidence.technicalIndicators,
    riskModel: sourcePacket.evidence.riskModel,
    dataCompleteness: sourcePacket.completeness,
    dataSourceStatus: sourcePacket.status,
    requiredOutput: {
      finalRecommendationCategories: ["WATCH", "HIGH RISK", "AVOID", "RESEARCH FURTHER", "MONITOR CLOSELY"],
      include: [
        "agent execution timeline",
        "research evidence summary with Evidence: lines",
        "analyst observations with Evidence: lines",
        "risk flags with Evidence: lines",
        "data source status",
        "confidence score based on data completeness",
        "illustrative position scenarios",
        "monitoring triggers",
        "financial disclaimer"
      ]
    }
  };
}

async function loadSwarmsPayload(): Promise<SwarmsPayload> {
  return JSON.parse(await readFile(join(process.cwd(), "swarm.payload.json"), "utf8")) as SwarmsPayload;
}

function parseJsonOrText(text: string): SwarmsResult {
  try {
    return JSON.parse(text) as SwarmsResult;
  } catch {
    return { raw: text };
  }
}

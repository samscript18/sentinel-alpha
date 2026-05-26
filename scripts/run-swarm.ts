import { readFile } from "fs/promises";
import { fail, isLikelySolanaAddress, loadDotEnv } from "./lib/env.ts";
import { buildSourcePacket, fetchWithTimeout } from "./lib/source-clients.ts";
import { printFinalReport, printSourceStatus, writeRunArtifacts } from "./lib/report.ts";
import type { AgentInput, CliArgs, SourcePacket, SwarmsPayload, SwarmsResult } from "./lib/types.ts";

const SWARMS_URL = "https://api.swarms.world/v1/swarm/completions";
const SWARMS_TIMEOUT_MS = Number(process.env.SWARMS_TIMEOUT_MS ?? 200000);

await loadDotEnv();

const args = parseArgs(process.argv.slice(2));
const tokenAddress = args.tokenAddress ?? process.env.DEFAULT_SOLANA_TOKEN_ADDRESS;

if (!tokenAddress) {
  fail([
    "Missing token address.",
    "Pass one as a CLI argument or set DEFAULT_SOLANA_TOKEN_ADDRESS in .env.",
    "Example: npm run demo -- So11111111111111111111111111111111111111112"
  ]);
}

if (!isLikelySolanaAddress(tokenAddress)) {
  fail([`Invalid Solana token address: ${tokenAddress}`]);
}

const payload = JSON.parse(await readFile(new URL("../swarm.payload.json", import.meta.url), "utf8")) as SwarmsPayload;
const startedAt = new Date().toISOString();

console.log(`Sentinel Alpha live-data preflight started at ${startedAt}`);
console.log(`Token: ${tokenAddress}`);

const sourcePacket = await buildSourcePacket(tokenAddress);
printSourceStatus(sourcePacket);

const agentInput = buildAgentInput(tokenAddress, sourcePacket);

if (args.preflightOnly) {
  const paths = await writeRunArtifacts({ outputDir: args.outputDir, agentInput, sourcePacket });
  console.log("\nPreflight-only mode enabled. No Swarms API call was made.");
  console.log(`Saved JSON evidence: ${paths.jsonPath}`);
  console.log(`Saved Markdown report: ${paths.markdownPath}`);
  console.log(`Saved agent trace: ${paths.tracePath}`);
  console.log(`Saved decision chain: ${paths.decisionPath}`);
  console.log(`Saved evidence report: ${paths.evidencePath}`);
  process.exit(0);
}

if (!process.env.SWARMS_API_KEY) {
  const paths = await writeRunArtifacts({ outputDir: args.outputDir, agentInput, sourcePacket });
  fail([
    "Live-data preflight completed, but SWARMS_API_KEY is not configured.",
    "Set SWARMS_API_KEY in .env or your shell to run the agent workflow.",
    "No Swarms API call was made.",
    `Saved JSON evidence: ${paths.jsonPath}`,
    `Saved Markdown report: ${paths.markdownPath}`
  ]);
}

const requestBody = {
  ...payload,
  task: `${payload.task}\n\nSTRUCTURED AGENT INPUT:\n${JSON.stringify(agentInput, null, 2)}`
};

let response: Response;
try {
  response = await fetchWithTimeout(
    SWARMS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SWARMS_API_KEY
      },
      body: JSON.stringify(requestBody)
    },
    SWARMS_TIMEOUT_MS
  );
} catch (error) {
  const paths = await writeRunArtifacts({ outputDir: args.outputDir, agentInput, sourcePacket });
  const message = error instanceof Error ? error.message : String(error);
  fail([
    `Swarms API request failed before a response was returned: ${message}`,
    `Timeout used: ${SWARMS_TIMEOUT_MS}ms. You can raise it with SWARMS_TIMEOUT_MS=200000.`,
    `Saved JSON evidence: ${paths.jsonPath}`,
    `Saved Markdown report: ${paths.markdownPath}`
  ]);
}

const text = await response.text();

if (!response.ok) {
  fail([`Swarms API error ${response.status}:`, text]);
}

const result = parseJsonOrText(text);
printFinalReport(result, sourcePacket);

const paths = await writeRunArtifacts({ outputDir: args.outputDir, agentInput, sourcePacket, result });
console.log("\nArtifacts");
console.log(`Saved JSON run: ${paths.jsonPath}`);
console.log(`Saved Markdown report: ${paths.markdownPath}`);
console.log(`Saved agent trace: ${paths.tracePath}`);
console.log(`Saved decision chain: ${paths.decisionPath}`);
console.log(`Saved evidence report: ${paths.evidencePath}`);

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {
    preflightOnly: false,
    outputDir: "artifacts/runs"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--token") {
      parsed.tokenAddress = argv[index + 1];
      index += 1;
    } else if (value === "--context") {
      fail(["Static context files are no longer accepted. Sentinel Alpha uses live evidence only."]);
    } else if (value === "--preflight-only") {
      parsed.preflightOnly = true;
    } else if (value === "--output-dir") {
      parsed.outputDir = argv[index + 1] ?? parsed.outputDir;
      index += 1;
    } else if (value.endsWith(".md")) {
      fail(["Markdown context files are not accepted as runtime input. Pass only a Solana token mint."]);
    } else if (!parsed.tokenAddress) {
      parsed.tokenAddress = value;
    }
  }

  return parsed;
}

function buildAgentInput(tokenAddress: string, sourcePacket: SourcePacket): AgentInput {
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

function parseJsonOrText(text: string): SwarmsResult {
  try {
    return JSON.parse(text) as SwarmsResult;
  } catch {
    return { raw: text };
  }
}

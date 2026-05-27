import { fail, isLikelySolanaAddress, loadDotEnv } from "./lib/env.ts";
import { printFinalReport, printSourceStatus } from "./lib/report.ts";
import { runSentinelAnalysis } from "./lib/workflow.ts";
import type { CliArgs } from "./lib/types.ts";

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

const startedAt = new Date().toISOString();

console.log(`Sentinel Alpha live-data preflight started at ${startedAt}`);
console.log(`Token: ${tokenAddress}`);

const preflight = await runSentinelAnalysis({
  tokenAddress,
  mode: "preflight",
  outputDir: args.outputDir,
  writeArtifacts: false
});
const { sourcePacket } = preflight;
printSourceStatus(sourcePacket);

if (args.preflightOnly) {
  const result = await runSentinelAnalysis({
    tokenAddress,
    mode: "preflight",
    outputDir: args.outputDir,
    writeArtifacts: true,
    sourcePacket
  });
  const paths = result.artifacts!;
  console.log("\nPreflight-only mode enabled. No Swarms API call was made.");
  console.log(`Saved JSON evidence: ${paths.jsonPath}`);
  console.log(`Saved Markdown report: ${paths.markdownPath}`);
  console.log(`Saved agent trace: ${paths.tracePath}`);
  console.log(`Saved decision chain: ${paths.decisionPath}`);
  console.log(`Saved evidence report: ${paths.evidencePath}`);
  process.exit(0);
}

if (!process.env.SWARMS_API_KEY) {
  const result = await runSentinelAnalysis({
    tokenAddress,
    mode: "preflight",
    outputDir: args.outputDir,
    writeArtifacts: true,
    sourcePacket
  });
  const paths = result.artifacts!;
  fail([
    "Live-data preflight completed, but SWARMS_API_KEY is not configured.",
    "Set SWARMS_API_KEY in .env or your shell to run the agent workflow.",
    "No Swarms API call was made.",
    `Saved JSON evidence: ${paths.jsonPath}`,
    `Saved Markdown report: ${paths.markdownPath}`
  ]);
}

let analysis;
try {
  analysis = await runSentinelAnalysis({
    tokenAddress,
    mode: "swarms",
    outputDir: args.outputDir,
    writeArtifacts: true,
    swarmsApiKey: process.env.SWARMS_API_KEY,
    sourcePacket
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail([
    `Swarms workflow failed: ${message}`,
    "You can raise the timeout with SWARMS_TIMEOUT_MS=200000."
  ]);
}

printFinalReport(analysis.swarmsResult ?? {}, analysis.sourcePacket);

const paths = analysis.artifacts!;
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

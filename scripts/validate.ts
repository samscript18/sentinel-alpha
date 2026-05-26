import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SwarmsPayload } from "./lib/types.ts";

const requiredFiles = [
  "README.md",
  "LAUNCH_FORM.md",
  "SUBMISSION.md",
  "marketplace-listing.md",
  "swarm.payload.json",
  "prompts/system.md",
  "scripts/run-swarm.ts",
  "scripts/validate.ts",
  "scripts/lib/types.ts",
  "scripts/lib/env.ts",
  "scripts/lib/source-clients.ts",
  "scripts/lib/report.ts",
  ".env.example",
  ".gitignore",
  "tsconfig.json"
];

const bannedTerms = [
  "mockData",
  "sampleData",
  "fakeResponse",
  "placeholderMetrics",
  "hardcodedPrice",
  "demoLiquidity",
  "fakeMarketData"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const payload = JSON.parse(await readFile("swarm.payload.json", "utf8")) as SwarmsPayload;
const readme = await readFile("README.md", "utf8");
const launchForm = await readFile("LAUNCH_FORM.md", "utf8");
const submission = await readFile("SUBMISSION.md", "utf8");
const listing = await readFile("marketplace-listing.md", "utf8");
const systemPrompt = await readFile("prompts/system.md", "utf8");
const runner = await readFile("scripts/run-swarm.ts", "utf8");
const envExample = await readFile(".env.example", "utf8");
const gitignore = await readFile(".gitignore", "utf8");
const packageText = await readFile("package.json", "utf8");
const packageJson = JSON.parse(packageText) as Record<string, any>;

for (const [label, content] of [
  ["README.md", readme],
  ["LAUNCH_FORM.md", launchForm],
  ["SUBMISSION.md", submission],
  ["marketplace-listing.md", listing],
  ["prompts/system.md", systemPrompt],
  ["scripts/run-swarm.ts", runner],
  ["swarm.payload.json", JSON.stringify(payload)]
]) {
  for (const term of bannedTerms) {
    if (content.includes(term)) {
      throw new Error(`${label} contains banned term: ${term}`);
    }
  }
}

const bannedStaticNarratives = [
  "bullish trend",
  "strong momentum",
  "consolidating after move",
  "consolidating after a strong move",
  "solana-market-brief.md"
];

for (const [label, content] of [
  ["README.md", readme],
  ["LAUNCH_FORM.md", launchForm],
  ["SUBMISSION.md", submission],
  ["marketplace-listing.md", listing],
  ["prompts/system.md", systemPrompt],
  ["scripts/run-swarm.ts", runner],
  ["package.json", packageText],
  ["swarm.payload.json", JSON.stringify(payload)]
]) {
  if (/\bJUP\b/.test(content)) {
    throw new Error(`${label} contains static token narrative term forbidden in runtime/submission flow: JUP`);
  }
  for (const term of bannedStaticNarratives) {
    if (content.includes(term)) {
      throw new Error(`${label} contains static narrative term forbidden in runtime/submission flow: ${term}`);
    }
  }
}

for (const mjsPath of ["scripts/run-swarm.mjs", "scripts/validate.mjs"]) {
  if (existsSync(resolve(mjsPath))) {
    throw new Error(`Unexpected .mjs file remains: ${mjsPath}`);
  }
}

const requiredTopLevel = ["name", "description", "swarm_type", "task", "agents", "rules"];
for (const key of requiredTopLevel) {
  if (!(payload as Record<string, unknown>)[key]) {
    throw new Error(`Missing top-level field: ${key}`);
  }
}

if (payload.swarm_type !== "AgentRearrange") {
  throw new Error(`Expected AgentRearrange directed sequential payload, received ${payload.swarm_type}`);
}

const expectedFlow = "Researcher Agent -> Analyst Agent -> Risk Manager Agent -> Executor/Recommender Agent";
if (payload.rearrange_flow !== expectedFlow) {
  throw new Error(`Expected rearrange_flow "${expectedFlow}", received "${payload.rearrange_flow}"`);
}

if (!Array.isArray(payload.agents) || payload.agents.length !== 4) {
  throw new Error("Expected exactly four agents.");
}

const expectedAgents = ["Researcher Agent", "Analyst Agent", "Risk Manager Agent", "Executor/Recommender Agent"];
const actualAgents = payload.agents.map((agent) => agent.agent_name);

for (let index = 0; index < expectedAgents.length; index += 1) {
  if (actualAgents[index] !== expectedAgents[index]) {
    throw new Error(`Agent ${index + 1} should be ${expectedAgents[index]}, received ${actualAgents[index]}`);
  }
}

const requiredAgentFields = [
  "name",
  "agent_name",
  "role",
  "objective",
  "input_expectations",
  "output_expectations",
  "handoff_instructions",
  "description",
  "model_name",
  "max_loops",
  "temperature",
  "system_prompt"
];

for (const agent of payload.agents) {
  for (const key of requiredAgentFields) {
    if (agent[key] === undefined || agent[key] === "") {
      throw new Error(`Agent ${agent.agent_name ?? "unknown"} missing ${key}`);
    }
  }
}

for (const key of [
  "SWARMS_API_KEY=",
  "HELIUS_API_KEY=",
  "BIRDEYE_API_KEY=",
  "DEFAULT_SOLANA_TOKEN_ADDRESS=",
  "SWARMS_TIMEOUT_MS=",
  "JUPITER_QUOTE_AMOUNT_BASE_UNITS=",
  "CRYPTOPANIC_API_KEY=",
  "GNEWS_API_KEY=",
  "NEWS_API_KEY=",
  "LUNARCRUSH_API_KEY="
]) {
  if (!envExample.includes(key)) {
    throw new Error(`.env.example missing ${key}`);
  }
}

for (const ignored of [".env", "artifacts/"]) {
  if (!gitignore.includes(ignored)) {
    throw new Error(`.gitignore should include ${ignored}`);
  }
}

for (const phrase of [
  "DexScreener",
  "Jupiter",
  "Helius",
  "Birdeye",
  "CoinDesk",
  "CoinTelegraph",
  "CryptoPanic",
  "GNews",
  "NewsAPI",
  "Reddit",
  "LunarCrush",
  "AVOID",
  "HIGH RISK",
  "WATCH",
  "RESEARCH FURTHER",
  "MONITOR CLOSELY",
  "Evidence:",
  "not financial advice",
  "preflight-only"
]) {
  const combined = `${readme}\n${launchForm}\n${submission}\n${listing}\n${systemPrompt}\n${JSON.stringify(payload)}`;
  if (!combined.includes(phrase)) {
    throw new Error(`Project docs/payload missing required phrase: ${phrase}`);
  }
}

if (!String(packageJson.scripts?.demo ?? "").includes("scripts/run-swarm.ts")) {
  throw new Error("package.json demo script must run scripts/run-swarm.ts");
}

if (String(packageJson.scripts?.demo ?? "").includes("--context")) {
  throw new Error("package.json demo script must not inject static context.");
}

if (runner.includes("readFile(resolve(contextPath)") || runner.includes("--context examples/")) {
  throw new Error("run-swarm.ts must not read static markdown context into agent input.");
}

if (!JSON.stringify(payload).includes("Evidence:")) {
  throw new Error("swarm.payload.json must require Evidence: blocks.");
}

console.log("Sentinel Alpha validation passed.");

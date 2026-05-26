import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentInput, SourcePacket, SwarmsResult } from "./types.ts";

export function printSourceStatus(packet: SourcePacket): void {
  console.log("\nData Source Status");
  for (const entry of packet.status) {
    console.log(`- ${entry.source}: ${entry.status} (${entry.message})`);
  }
  console.log(
    `Completeness: ${packet.completeness.label} (${packet.completeness.score}); confidence ${packet.completeness.confidenceScore}/100`
  );
  console.log(`Pre-agent category: ${packet.completeness.recommendationCategory}`);
}

export function printFinalReport(result: SwarmsResult, sourcePacket: SourcePacket): void {
  console.log("\nSentinel Alpha Report");
  console.log(`Job: ${result.job_id ?? "unknown"}`);
  console.log(`Status: ${result.status ?? "unknown"}`);
  console.log(`Data completeness: ${sourcePacket.completeness.label} (${sourcePacket.completeness.score})`);

  const outputs = Array.isArray(result.output) ? result.output.filter((entry) => entry.role !== "system") : [];
  const expected = ["Researcher Agent", "Analyst Agent", "Risk Manager Agent", "Executor/Recommender Agent"];
  const roles = outputs.map((entry) => entry.role);

  if (roles.length > 0 && expected.some((role, index) => roles[index] !== role)) {
    console.warn("\nWarning: Swarms returned agent outputs in an unexpected order.");
    console.warn(`Expected: ${expected.join(" -> ")}`);
    console.warn(`Received: ${roles.join(" -> ")}`);
  }

  console.log("\nAgent Execution Timeline");
  outputs.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.role}`);
  });

  const final = outputs.find((entry) => entry.role === "Executor/Recommender Agent") ?? outputs.at(-1);
  if (final?.content) {
    console.log("\nFinal Decision-Support Output");
    console.log(final.content);
  }
}

export async function writeRunArtifacts(params: {
  outputDir: string;
  agentInput: AgentInput;
  sourcePacket: SourcePacket;
  result?: SwarmsResult;
}): Promise<{ jsonPath: string; markdownPath: string; tracePath: string; decisionPath: string; evidencePath: string }> {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(params.outputDir, { recursive: true });

  const jsonPath = join(params.outputDir, `sentinel-alpha-${runId}.json`);
  const markdownPath = join(params.outputDir, `sentinel-alpha-${runId}.md`);
  const tracePath = join(params.outputDir, `agent-trace-${runId}.json`);
  const decisionPath = join(params.outputDir, `decision-chain-${runId}.json`);
  const evidencePath = join(params.outputDir, `evidence-report-${runId}.md`);

  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        agentInput: params.agentInput,
        sourcePacket: params.sourcePacket,
        swarmsResult: params.result ?? null
      },
      null,
      2
    )
  );

  await writeFile(markdownPath, renderMarkdown(params.agentInput, params.sourcePacket, params.result));
  await writeFile(tracePath, JSON.stringify(buildAgentTrace(params.result), null, 2));
  await writeFile(decisionPath, JSON.stringify(buildDecisionChain(params.agentInput, params.sourcePacket, params.result), null, 2));
  await writeFile(evidencePath, renderEvidenceReport(params.agentInput, params.sourcePacket, params.result));

  return { jsonPath, markdownPath, tracePath, decisionPath, evidencePath };
}

function renderMarkdown(agentInput: AgentInput, sourcePacket: SourcePacket, result?: SwarmsResult): string {
  const outputs = Array.isArray(result?.output) ? result.output.filter((entry) => entry.role !== "system") : [];
  const final = outputs.find((entry) => entry.role === "Executor/Recommender Agent") ?? outputs.at(-1);

  return `# Sentinel Alpha Run

Generated: ${agentInput.timestamp}

Token: \`${agentInput.tokenAddress}\`

## Data Source Status

${sourcePacket.status.map((entry) => `- ${entry.source}: ${entry.status} (${entry.message})`).join("\n")}

## Completeness

- Label: ${sourcePacket.completeness.label}
- Score: ${sourcePacket.completeness.score}
- Confidence: ${sourcePacket.completeness.confidenceScore}/100
- Pre-agent category: ${sourcePacket.completeness.recommendationCategory}
- Rationale: ${sourcePacket.completeness.confidenceRationale}

## Quote Sizing

${agentInput.jupiter.quoteInfo?.quoteInputLabel ?? "insufficient evidence"}

## News And Sentiment

- News items: ${agentInput.news.items.length}
- Sentiment confidence: ${agentInput.sentiment.confidence}
- Social velocity: ${agentInput.sentiment.socialVelocity ?? "insufficient evidence"}

## Risk Model

- Risk score: ${agentInput.riskModel.riskScore}
- Risk confidence: ${agentInput.riskModel.confidence}
- Illustrative conservative scenario: ${agentInput.riskModel.illustrativePositionScenarios.conservative}
- Active alerts: ${agentInput.riskModel.activeAlerts.length === 0 ? "none" : agentInput.riskModel.activeAlerts.length}
- Monitoring triggers: ${agentInput.riskModel.monitoringTriggers.length}

## Agent Execution Timeline

${outputs.length > 0 ? outputs.map((entry, index) => `${index + 1}. ${entry.role}`).join("\n") : "No Swarms agent run recorded."}

## Final Decision-Support Output

${final?.content ?? "No final Swarms output recorded."}

## Disclaimer

Sentinel Alpha provides research, risk analysis, and decision support only. It is not financial advice and does not execute transactions.
`;
}

function buildAgentTrace(result?: SwarmsResult) {
  const now = new Date().toISOString();
  const outputs = Array.isArray(result?.output) ? result.output.filter((entry) => entry.role !== "system") : [];
  return outputs.length > 0
    ? outputs.map((entry, index) => ({
        sequence: index + 1,
        agent: entry.role,
        completedAt: now,
        evidenceRequired: true
      }))
    : [
        {
          sequence: 0,
          agent: "Live Data Preflight",
          completedAt: now,
          evidenceRequired: true
        }
      ];
}

function buildDecisionChain(agentInput: AgentInput, sourcePacket: SourcePacket, result?: SwarmsResult) {
  const outputs = Array.isArray(result?.output) ? result.output.filter((entry) => entry.role !== "system") : [];
  return {
    dataCompleteness: sourcePacket.completeness,
    preAgentCategory: sourcePacket.completeness.recommendationCategory,
    riskModel: agentInput.riskModel,
    confidenceChain: [
      {
        stage: "preflight",
        confidence: sourcePacket.completeness.confidenceScore,
        evidence: "dataCompleteness"
      },
      {
        stage: "risk",
        confidence: agentInput.riskModel.confidence,
        evidence: "riskModel"
      }
    ],
    agentOutputs: outputs.map((entry) => ({
      agent: entry.role,
      hasEvidenceBlocks: entry.content.includes("Evidence:")
    }))
  };
}

function renderEvidenceReport(agentInput: AgentInput, sourcePacket: SourcePacket, result?: SwarmsResult): string {
  const outputs = Array.isArray(result?.output) ? result.output.filter((entry) => entry.role !== "system") : [];
  return `# Sentinel Alpha Evidence Report

Generated: ${agentInput.timestamp}

Token: \`${agentInput.tokenAddress}\`

## Source Status

${sourcePacket.status.map((entry) => `- ${entry.source}: ${entry.status} (${entry.message})`).join("\n")}

## Market Evidence

- DexScreener price: ${agentInput.dexScreener.price ?? "insufficient evidence"}
- DexScreener liquidity: ${agentInput.dexScreener.liquidity ?? "insufficient evidence"}
- DexScreener pair count: ${agentInput.dexScreener.pairCount}
- Jupiter route available: ${agentInput.jupiter.routeAvailable}
- Quote input: ${agentInput.jupiter.quoteInfo?.quoteInputLabel ?? "insufficient evidence"}

## News Evidence

${agentInput.news.items.length > 0 ? agentInput.news.items.map((item) => `- ${item.headline} (${item.source}, relevance ${item.relevance})`).join("\n") : "insufficient evidence"}

## Sentiment Evidence

- Score: ${agentInput.sentiment.score ?? "insufficient evidence"}
- Confidence: ${agentInput.sentiment.confidence}
- Social velocity: ${agentInput.sentiment.socialVelocity ?? "insufficient evidence"}

## Technical Evidence

- RSI: ${agentInput.technicalAnalysis.rsi ?? "insufficient evidence"}
- EMA20: ${agentInput.technicalAnalysis.ema20 ?? "insufficient evidence"}
- EMA50: ${agentInput.technicalAnalysis.ema50 ?? "insufficient evidence"}
- Reason: ${agentInput.technicalAnalysis.reason}

## Risk Evidence

${agentInput.riskModel.dimensions.map((dimension) => `- ${dimension.name}: ${dimension.status}. Evidence: ${dimension.evidence}. Interpretation: ${dimension.interpretation}`).join("\n")}

## Active Alerts

${agentInput.riskModel.activeAlerts.length > 0 ? agentInput.riskModel.activeAlerts.map((alert) => `- ${alert.title}: ${alert.severity}. Evidence: ${alert.evidence}`).join("\n") : "none"}

## Monitoring Triggers

${agentInput.riskModel.monitoringTriggers.map((trigger) => `- ${trigger.title}: ${trigger.trigger}. Severity if triggered: ${trigger.severityIfTriggered}. Evidence: ${trigger.evidence}`).join("\n")}

## Agent Evidence Blocks

${outputs.length > 0 ? outputs.map((entry) => `## ${entry.role}\n\n${entry.content}`).join("\n\n") : "No Swarms agent output recorded."}
`;
}

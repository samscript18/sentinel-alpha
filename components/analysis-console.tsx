"use client";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { analyzeToken } from "../lib/analyze-client";
import { QUICK_TOKENS } from "../lib/tokens";
import type { AnalyzeResponse } from "../types/dashboard";
import { QueryProvider } from "./query-provider";

const timeline = [
  "Researcher Agent",
  "News/Sentiment",
  "Technical Analysis",
  "Risk Analysis",
  "Recommendation"
];

const waitingSources = ["DexScreener", "Jupiter", "Helius", "Birdeye", "RSS", "Reddit"];

export function AnalysisConsole() {
  return (
    <QueryProvider>
      <AnalysisConsoleInner />
    </QueryProvider>
  );
}

function AnalysisConsoleInner() {
  const [tokenAddress, setTokenAddress] = useState<string>(QUICK_TOKENS[0].address);
  const mutation = useMutation({ mutationFn: analyzeToken });
  const result = mutation.data;
  const isLoading = mutation.isPending;

  return (
    <section id="analysis" className="space-y-5">
      <div className="surface overflow-hidden rounded-3xl md:rounded-[2rem]">
        <div className="grid min-w-0 gap-0 2xl:grid-cols-[420px_1fr]">
          <div className="border-b border-white/10 p-4 sm:p-6 2xl:border-b-0 2xl:border-r">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Analysis Console</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Command Deck</h2>
              </div>
              <StatusPill label={isLoading ? "running" : result ? "ready" : "idle"} />
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Submit a Solana mint. The dashboard builds a live evidence packet first, then renders the same
              source status, risk model, traces, and artifacts used by the CLI workflow.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500" htmlFor="token">
                Token Address
              </label>
              <input
                id="token"
                value={tokenAddress}
                onChange={(event) => setTokenAddress(event.target.value)}
                className="mono h-14 w-full rounded-2xl border border-white/10 bg-black/50 px-4 text-sm text-white outline-none ring-violetline/50 transition focus:border-violetline focus:ring-4"
                placeholder="Solana token mint"
              />
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                {QUICK_TOKENS.map((token) => (
                  <button
                    key={token.symbol}
                    type="button"
                    onClick={() => setTokenAddress(token.address)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:border-violetline/70 hover:bg-violetline/10"
                  >
                    <span className="block text-sm font-semibold text-zinc-100">{token.symbol}</span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">{token.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => mutation.mutate(tokenAddress)}
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-violetline to-violet-500 px-5 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Analyzing live evidence..." : "Run Analysis"}
              </button>
              {mutation.error ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                  {mutation.error instanceof Error ? mutation.error.message : "Analysis failed."}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_310px]">
            <EvidenceDashboard result={result} loading={isLoading} />
            <ExecutionTimeline loading={isLoading} result={result} />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
        <RecommendationPanel result={result} loading={isLoading} />
        <TraceAndArtifacts result={result} />
      </div>
    </section>
  );
}

function ExecutionTimeline({ loading, result }: { loading: boolean; result?: AnalyzeResponse }) {
  return (
    <div className="panel h-fit rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Agent Timeline</p>
          <h3 className="mt-1 text-lg font-semibold sm:text-xl">Run Path</h3>
        </div>
        <div className="h-12 w-12 rounded-2xl border border-terminal/25 bg-terminal/10" />
      </div>
      <div className="mt-5 space-y-1">
        {timeline.map((step, index) => {
          const done = Boolean(result) || (loading && index < 2);
          return (
            <div key={step} className="grid grid-cols-[34px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                    done
                      ? "border-terminal/70 bg-terminal/10 text-terminal"
                      : "border-white/10 bg-white/[0.03] text-zinc-500"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </div>
                {index < timeline.length - 1 ? <div className="h-8 w-px bg-white/10" /> : null}
              </div>
              <div className="pb-4">
                <p className="text-sm font-semibold">{step}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {done ? "Evidence packet updated" : loading ? "Queued" : "Waiting for run"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceDashboard({ result, loading }: { result?: AnalyzeResponse; loading: boolean }) {
  const input = result?.agentInput;
  const status = (result?.sourcePacket.status ?? []).filter((entry) => entry.status !== "not_configured");
  const token = tokenIdentity(result);
  const cards = [
    ["Price", input?.dexScreener.price ?? "insufficient evidence", "DexScreener price"],
    ["Liquidity", formatUsd(input?.dexScreener.liquidity), "DexScreener liquidity"],
    ["Volume", formatJson(input?.dexScreener.volume), "Observed volume fields"],
    ["Pairs", input?.dexScreener.pairCount ?? "insufficient evidence", "Solana pair count"],
    ["News", input ? `${input.news.items.length} recent item(s)` : "insufficient evidence", "RSS/API window"],
    ["Reddit", input?.sentiment.socialVelocity ?? "insufficient evidence", "Public mentions"],
    ["Sentiment", input?.sentiment.confidence ?? "insufficient evidence", "Confidence only"],
    ["Confidence", input ? `${input.dataCompleteness.confidenceScore}/100` : "insufficient evidence", "Source coverage"]
  ];

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Evidence Dashboard</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Live Market Intelligence</h3>
        </div>
        <StatusPill label={loading ? "running" : result ? result.mode : "idle"} />
      </div>

      <TokenIdentityCard token={token} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, caption]) => (
          <MetricCard key={String(label)} label={String(label)} value={String(value)} caption={String(caption)} />
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
        <div className="hidden border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 md:grid md:grid-cols-[160px_140px_minmax(0,1fr)] xl:grid-cols-[180px_150px_minmax(0,1fr)]">
          <span>Source</span>
          <span>Status</span>
          <span>Message</span>
        </div>
        <div className="divide-y divide-white/10">
          {status.length > 0
            ? status.map((entry) => (
                <div key={entry.source} className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[160px_140px_minmax(0,1fr)] md:gap-3 xl:grid-cols-[180px_150px_minmax(0,1fr)]">
                  <p className="text-sm font-semibold">{entry.source}</p>
                  <StatusPill label={entry.status} />
                  <p className="min-w-0 break-words text-xs leading-5 text-zinc-500">{entry.message}</p>
                </div>
              ))
            : waitingSources.map((source) => (
                <div key={source} className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[160px_140px_minmax(0,1fr)] md:gap-3 xl:grid-cols-[180px_150px_minmax(0,1fr)]">
                  <p className="text-sm font-semibold">{source}</p>
                  <StatusPill label="waiting" />
                  <p className="min-w-0 break-words text-xs leading-5 text-zinc-500">Waiting for analysis run.</p>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

function TokenIdentityCard({ token }: { token: ReturnType<typeof tokenIdentity> }) {
  return (
    <div className="mb-5 grid min-w-0 gap-3 rounded-3xl border border-white/10 bg-black/30 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1.15fr_1fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Token</p>
        <p className="mt-2 text-xl font-semibold text-white">{token.symbol}</p>
        <p className="mt-1 text-sm text-zinc-500">{token.name}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Mint</p>
        <p className="mono mt-2 break-all text-sm leading-6 text-zinc-300">{token.address}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Primary Pair</p>
        <p className="mt-2 text-sm font-semibold text-zinc-200">{token.pairLabel}</p>
        <p className="mt-1 text-xs text-zinc-500">Evidence: {token.evidence}</p>
      </div>
    </div>
  );
}

function RecommendationPanel({ result, loading }: { result?: AnalyzeResponse; loading: boolean }) {
  const input = result?.agentInput;
  const category = input?.dataCompleteness.recommendationCategory ?? (loading ? "Analyzing" : "No run yet");
  const risk = input?.riskModel;
  const finalOutput = result?.swarmsResult?.output?.find((entry) => entry.role === "Executor/Recommender Agent")?.content;

  return (
    <div className="surface rounded-3xl p-4 sm:p-6 md:rounded-[2rem]">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Recommendation Panel</p>
          <h3 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{category}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Decision-support category derived from data completeness and available evidence. This is research
            support only, not a buy or sell instruction.
          </p>
        </div>
        <div className="panel rounded-3xl p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Confidence</p>
          <p className="mono mt-3 text-4xl font-semibold text-terminal">
            {input ? input.dataCompleteness.confidenceScore : "--"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">out of 100</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PanelBlock
          title="Reasoning"
          lines={[
            input?.dataCompleteness.confidenceRationale ?? "insufficient evidence",
            `Evidence: dataCompleteness=${input?.dataCompleteness.score ?? "insufficient evidence"}`
          ]}
        />
        <PanelBlock
          title="Position Scenarios"
          lines={[
            risk?.illustrativePositionScenarios.conservative ?? "insufficient evidence",
            risk?.illustrativePositionScenarios.balanced ?? "insufficient evidence",
            risk?.illustrativePositionScenarios.aggressive ?? "insufficient evidence",
            "Illustrative risk framing only; not financial advice."
          ]}
        />
        <PanelBlock
          title="Active Alerts"
          lines={
            risk?.activeAlerts.length
              ? risk.activeAlerts.map((alert) => `${alert.title}: ${alert.severity}. Evidence: ${alert.evidence}`)
              : ["none"]
          }
        />
      </div>

      <div className="mt-4">
        <PanelBlock
          title="Monitoring Triggers"
          lines={
            risk?.monitoringTriggers.map(
              (trigger) => `${trigger.title}: ${trigger.trigger}. Evidence: ${trigger.evidence}`
            ) ?? ["insufficient evidence"]
          }
        />
      </div>

      {finalOutput ? (
        <pre className="mt-5 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-3xl border border-white/10 bg-black/60 p-4 text-xs leading-6 text-zinc-300 sm:p-5">
          {finalOutput}
        </pre>
      ) : null}
    </div>
  );
}

function TraceAndArtifacts({ result }: { result?: AnalyzeResponse }) {
  const trace = useMemo(() => buildTrace(result), [result]);

  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-2 2xl:grid-cols-1">
      <div className="surface rounded-3xl p-4 sm:p-6 md:rounded-[2rem]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Trace Viewer</p>
        <h3 className="mt-2 text-2xl font-semibold">Decision Chain</h3>
        <div className="mt-5 space-y-3">
          {trace.map((item) => (
            <div key={item.title} className="panel rounded-2xl p-4">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="surface rounded-3xl p-4 sm:p-6 md:rounded-[2rem]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Artifact Panel</p>
        <h3 className="mt-2 text-2xl font-semibold">Export Evidence</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Download the current run packet for review, judging, or marketplace proof.
        </p>
        <div className="mt-5 grid gap-3">
          <DownloadButton label="Download JSON" filename="sentinel-alpha-run.json" content={result ? JSON.stringify(result, null, 2) : ""} />
          <DownloadButton label="Download Markdown" filename="sentinel-alpha-report.md" content={result ? renderMarkdown(result) : ""} />
          <DownloadButton label="Download Evidence Report" filename="sentinel-alpha-evidence.md" content={result ? renderEvidence(result) : ""} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="panel min-h-28 rounded-3xl p-4 sm:min-h-32">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
        <div className="h-2 w-2 rounded-full bg-terminal/80" />
      </div>
      <p className="mono mt-4 break-words text-lg font-semibold leading-7 text-zinc-100 sm:text-xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{caption}</p>
    </div>
  );
}

function PanelBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="panel min-w-0 rounded-3xl p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <p key={`${title}-${index}`} className="break-words text-sm leading-6 text-zinc-400">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone =
    label === "available" || label === "ready" || label === "preflight"
      ? "border-terminal/30 bg-terminal/10 text-terminal"
      : label === "error" || label === "unavailable"
        ? "border-red-400/30 bg-red-500/10 text-red-200"
        : "border-white/10 bg-white/[0.05] text-zinc-300";

  return (
    <span className={`w-fit rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.12em] ${tone}`}>
      {label}
    </span>
  );
}

function DownloadButton({ label, filename, content }: { label: string; filename: string; content: string }) {
  return (
    <button
      type="button"
      disabled={!content}
      onClick={() => downloadText(filename, content)}
      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm font-semibold text-zinc-200 transition hover:border-violetline/70 hover:bg-violetline/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function buildTrace(result?: AnalyzeResponse) {
  if (!result) {
    return timeline.map((title) => ({ title, detail: "Waiting for analysis run." }));
  }

  return [
    {
      title: "Research completed",
      detail: `DexScreener pairs=${result.agentInput.dexScreener.pairCount}; Evidence: source status packet`
    },
    {
      title: "News analyzed",
      detail: `News items=${result.agentInput.news.items.length}; Evidence: RSS/API news evidence`
    },
    {
      title: "Sentiment analyzed",
      detail: `Sentiment confidence=${result.agentInput.sentiment.confidence}; Evidence: social evidence packet`
    },
    {
      title: "Risk scored",
      detail: `Risk score=${result.agentInput.riskModel.riskScore}; Evidence: riskModel dimensions`
    },
    {
      title: "Recommendation generated",
      detail: `Category=${result.agentInput.dataCompleteness.recommendationCategory}; Evidence: dataCompleteness confidence`
    }
  ];
}

function renderMarkdown(result: AnalyzeResponse) {
  return `# Sentinel Alpha Dashboard Run

Token: \`${result.agentInput.tokenAddress}\`

Category: ${result.agentInput.dataCompleteness.recommendationCategory}

Confidence: ${result.agentInput.dataCompleteness.confidenceScore}/100

Evidence: dataCompleteness=${result.agentInput.dataCompleteness.score}

## Source Status

${result.sourcePacket.status.map((entry) => `- ${entry.source}: ${entry.status} (${entry.message})`).join("\n")}
`;
}

function renderEvidence(result: AnalyzeResponse) {
  return `# Evidence Report

Evidence: DexScreener liquidity=${result.agentInput.dexScreener.liquidity ?? "insufficient evidence"}

Evidence: Jupiter routeAvailable=${result.agentInput.jupiter.routeAvailable}

Evidence: sentimentConfidence=${result.agentInput.sentiment.confidence}

Evidence: newsItems=${result.agentInput.news.items.length}
`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number") return "insufficient evidence";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatJson(value: unknown) {
  if (!value) return "insufficient evidence";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function tokenIdentity(result?: AnalyzeResponse) {
  const input = result?.agentInput;
  const baseToken = input?.tokenMetadata.dexScreenerBaseToken as any;
  const pair = input?.dexScreener.pairs?.[0];
  const quoteToken = pair?.quoteToken as any;
  const symbol = typeof baseToken?.symbol === "string" ? baseToken.symbol : "Unknown token";
  const name = typeof baseToken?.name === "string" ? baseToken.name : "insufficient evidence";
  const pairLabel =
    pair && typeof quoteToken?.symbol === "string"
      ? `${pair.dexId ?? "DEX"} / ${quoteToken.symbol}`
      : pair?.dexId
        ? String(pair.dexId)
        : "insufficient evidence";

  return {
    symbol,
    name,
    address: input?.tokenAddress ?? "No token analyzed yet",
    pairLabel,
    evidence: pair ? "DexScreener baseToken + primary pair" : "insufficient evidence"
  };
}

import { NextResponse } from "next/server";
import { isLikelySolanaAddress, loadDotEnv } from "../../../scripts/lib/env.ts";
import { runSentinelAnalysis } from "../../../scripts/lib/workflow.ts";

export const runtime = "nodejs";
export const maxDuration = 200;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Sentinel Alpha analyze API",
    method: "POST",
    requiredBody: {
      tokenAddress: "Solana token mint",
      runSwarms: true
    }
  });
}

export async function POST(request: Request) {
  await loadDotEnv();

  try {
    const body = (await request.json()) as { tokenAddress?: string; runSwarms?: boolean };
    const tokenAddress = body.tokenAddress?.trim();

    if (!tokenAddress) {
      return NextResponse.json({ error: "Missing tokenAddress." }, { status: 400 });
    }

    if (!isLikelySolanaAddress(tokenAddress)) {
      return NextResponse.json({ error: "Invalid Solana token address." }, { status: 400 });
    }

    const shouldRunSwarms = Boolean(body.runSwarms);
    if (shouldRunSwarms && !process.env.SWARMS_API_KEY) {
      return NextResponse.json(
        {
          error:
            "SWARMS_API_KEY is not configured. The dashboard runs the full demo workflow, so add SWARMS_API_KEY to .env before running analysis."
        },
        { status: 400 }
      );
    }

    const result = await runSentinelAnalysis({
      tokenAddress,
      mode: shouldRunSwarms ? "swarms" : "preflight",
      writeArtifacts: !process.env.VERCEL,
      outputDir: process.env.VERCEL ? "/tmp/sentinel-alpha-runs" : "artifacts/runs",
      swarmsApiKey: process.env.SWARMS_API_KEY
    });

    return NextResponse.json({
      mode: shouldRunSwarms ? "swarms" : "preflight",
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Sentinel Alpha analyze API failed:", error);
    return NextResponse.json(
      {
        error: message || "Analysis failed.",
        hint:
          "Check Vercel environment variables, serverless timeout limits, and upstream source/API availability. Dashboard runs require SWARMS_API_KEY."
      },
      { status: 500 }
    );
  }
}

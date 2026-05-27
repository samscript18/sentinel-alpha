import { NextResponse } from "next/server";
import { isLikelySolanaAddress, loadDotEnv } from "../../../scripts/lib/env.ts";
import { runSentinelAnalysis } from "../../../scripts/lib/workflow.ts";

export const runtime = "nodejs";
export const maxDuration = 200;

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
      writeArtifacts: true,
      outputDir: "artifacts/runs",
      swarmsApiKey: process.env.SWARMS_API_KEY
    });

    return NextResponse.json({
      mode: shouldRunSwarms ? "swarms" : "preflight",
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message || "Analysis failed." }, { status: 500 });
  }
}

import type { AgentInput, SourcePacket, SwarmsResult } from "../scripts/lib/types";

export type AnalyzeResponse = {
  mode: "preflight" | "swarms";
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

import axios from "axios";
import type { AnalyzeResponse } from "../types/dashboard";

export async function analyzeToken(tokenAddress: string): Promise<AnalyzeResponse> {
  const response = await axios.post<AnalyzeResponse>("/api/analyze", { tokenAddress, runSwarms: true });
  return response.data;
}

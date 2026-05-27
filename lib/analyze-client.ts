import axios from "axios";
import type { AnalyzeResponse } from "../types/dashboard";

export async function analyzeToken(tokenAddress: string): Promise<AnalyzeResponse> {
  try {
    const response = await axios.post<AnalyzeResponse>("/api/analyze", { tokenAddress, runSwarms: true });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const payload = error.response?.data as { error?: string; hint?: string } | undefined;
      const message = [payload?.error, payload?.hint].filter(Boolean).join(" ");
      throw new Error(message || error.message);
    }
    throw error;
  }
}

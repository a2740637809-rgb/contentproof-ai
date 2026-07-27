import { analyzeEvidence, type EvidenceItem, type Signal } from "./lib/analyzer";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

type AnalysisResponse = {
  mode: "rules-v1" | "browser-rules";
  signals: Signal[];
  fallbackReason?: "local-api-unavailable";
};

export async function analyzeSignals(items: EvidenceItem[]): Promise<AnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE.replace(/\/api$/, "")}/api/v2/signals/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) throw new Error(`signal API ${response.status}`);
    return (await response.json()) as AnalysisResponse;
  } catch {
    return {
      ...analyzeEvidence(items),
      fallbackReason: "local-api-unavailable",
    };
  }
}

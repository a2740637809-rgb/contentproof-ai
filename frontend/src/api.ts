import { analyzeEvidence, type EvidenceItem, type Signal } from "./lib/analyzer";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export type Project = {
  id: number; name: string; goal: string; stage: string;
  lifecycle?: "active" | "archived" | "trashed";
  comment_count?: number; created_at?: string; updated_at?: string;
};
export type Comment = {
  id: number; raw_text: string; cleaned_text: string; status: "included" | "excluded";
  exclusion_reasons: string[]; pii_flags: string[];
};
export type Theme = {
  id: number; name: string; summary: string;
  status: "pending_review" | "confirmed" | "rejected";
  comment_ids: number[]; cluster_label: number;
};
export type Brief = {
  id: number; version: number; title: string; audience: string; problem: string;
  angle: string; outline: string[]; risks: string[]; evidence_comment_ids: number[];
  theme_ids: number[]; generation_mode: string;
};
export type ImportReceipt = {
  source_id: number; created: number; duplicates: number; article_status: string;
  comments_status: string; warnings: string[];
};
export type AnalysisRun = {
  id: number; status: string; model: string; method: string;
  steps: { key: string; label: string; status: string; metrics: Record<string, number> }[];
  metrics: {
    comments: number; included: number; themes: number;
    evidence_coverage: number; human_confirmation_rate: number;
  };
  human_gate: { required: boolean; confirmed: number; pending: number };
};
export type Benchmark = {
  sample_size: number;
  strategies: Record<string, {
    label: string; model?: string; themes: number;
    evidence_coverage: number; human_confirmation_rate: number;
  }>;
  note: string;
};
export type ModelProfile = {
  id: number; name: string; provider: "rules" | "ollama" | "openai_compatible";
  base_url: string; model: string; embedding_model: string; secret_env: string;
  secret_configured: boolean; enabled: boolean;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const multipart = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: multipart ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(body.detail ?? `API ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function importWeb(projectId: number, url: string) {
  return api<ImportReceipt>(`/v2/projects/${projectId}/imports/web`, { method: "POST", body: JSON.stringify({ url }) });
}
export function importManual(projectId: number, comments: string[]) {
  return api<ImportReceipt>(`/v2/projects/${projectId}/imports/manual`, { method: "POST", body: JSON.stringify({ comments }) });
}
export function importSpreadsheet(projectId: number, file: File) {
  const body = new FormData(); body.append("file", file);
  return api<ImportReceipt>(`/v2/projects/${projectId}/imports/spreadsheet`, { method: "POST", body });
}
export function analyzeProject(projectId: number) {
  return api<{ id: number; status: string; embedding_model: string; clustering_method: string; themes: Theme[] }>(
    `/v2/projects/${projectId}/analysis`, { method: "POST", body: JSON.stringify({ mode: "semantic" }) },
  );
}
export function createBrief(projectId: number) {
  return api<Brief>(`/v2/projects/${projectId}/briefs`, { method: "POST", body: JSON.stringify({}) });
}

type AnalysisResponse = { mode: "rules-v1" | "browser-rules"; signals: Signal[]; fallbackReason?: "local-api-unavailable" };
export async function analyzeSignals(items: EvidenceItem[]): Promise<AnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE.replace(/\/api$/, "")}/api/v2/signals/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }), signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) throw new Error();
    return await response.json() as AnalysisResponse;
  } catch {
    return { ...analyzeEvidence(items), fallbackReason: "local-api-unavailable" };
  }
}

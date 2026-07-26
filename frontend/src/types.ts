export type Mode = "demo" | "live";
export type Page = "dashboard" | "sources" | "workflow" | "experiments" | "evaluations" | "review";
export type Status = "pending" | "queued" | "running" | "completed" | "failed";

export interface Source {
  id: number; title: string; url: string; excerpt: string;
  status: "verified" | "pending" | "rejected";
  facts: { text: string; status: string }[];
}
export interface Step {
  name: string; status: Status; elapsed_ms?: number;
  output_json: Record<string, unknown>; error: string;
}
export interface Run {
  id: number; status: Status; model_name: string; prompt_version_id: number;
  steps: Step[];
}
export interface Dimension { score: number; reason: string; evidence: string[] }
export interface Evaluation {
  id: number; run_id: number; total: number;
  dimensions: Record<string, Dimension>; human_decision?: string | null;
}
export interface Task {
  id: number; title: string; target_platform: string; audience: string; tone: string;
  content_type: string; min_words: number; max_words: number; status: string;
  sources: Source[]; runs: Run[];
}

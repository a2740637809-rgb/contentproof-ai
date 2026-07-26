export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowStep {
  name: string;
  status: StepStatus;
  elapsedMs?: number;
  error?: string;
}

export interface Evaluation {
  total: number;
  advisory: true;
  scores: Record<string, number>;
  reasons?: Record<string, string>;
}

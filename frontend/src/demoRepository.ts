import { seedEvaluation, seedTask } from "./seed";
import type { Evaluation, Run, Source, Task } from "./types";

const clone = <T,>(value: T): T => structuredClone(value);
export class DemoRepository {
  task = clone(seedTask);
  evaluation = clone(seedEvaluation);
  async reset() { this.task = clone(seedTask); this.evaluation = clone(seedEvaluation); return this.task; }
  async addSource(input: Omit<Source, "id">) {
    const source = { ...input, id: Date.now() }; this.task.sources.push(source); return source;
  }
  async run(): Promise<Run> {
    const steps = ["facts", "outline", "draft", "adapt"].map((name, index) => ({
      name, status: "completed" as const, elapsed_ms: 420 + index * 190, error: "",
      output_json: { text: index === 3 ? "端午将至，常德一场安全宣传活动把反诈与禁毒知识融入节日互动。" : `${name} 已生成` },
    }));
    const run = { id: Date.now(), status: "completed" as const, model_name: "演示模型", prompt_version_id: 2, steps };
    this.task.runs = [run, ...this.task.runs]; this.evaluation.run_id = run.id; return run;
  }
}

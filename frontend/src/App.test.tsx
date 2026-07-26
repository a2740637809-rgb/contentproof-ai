import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("ContentProof workbench", () => {
  it("shows workflow, advisory scoring and prompt comparison", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ContentProof AI" }),
    ).toBeInTheDocument();
    expect(screen.getByText("工作流轨迹")).toBeInTheDocument();
    expect(screen.getByText("模型辅助评分，仅供参考")).toBeInTheDocument();
    expect(screen.getByText("Prompt v1")).toBeInTheDocument();
    expect(screen.getByText("+6.5")).toBeInTheDocument();
  });
});

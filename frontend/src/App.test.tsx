import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(cleanup);

describe("SignalProof flagship", () => {
  it("explains one signal-to-decision product", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "把用户声音变成 可验证 的内容决策。" })).toBeInTheDocument();
    expect(screen.getByText("信号河流")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "从最高机会创建内容简报 ↗" })).toBeEnabled();
  });

  it("creates a brief with evidence and advances to the experiment", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "从最高机会创建内容简报 ↗" }));
    expect(screen.getByText("✓ 简报已创建")).toBeInTheDocument();
    expect(screen.getByText("证据 F002")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "进入内容实验 ↗" }));
    expect(screen.getByRole("heading", { name: "内容实验" })).toBeInTheDocument();
  });
});

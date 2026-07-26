import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";

afterEach(cleanup);

describe("ContentProof product", () => {
  it("enters demo mode and exposes six functional areas", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /立即体验示例/ }));

    expect(screen.getAllByText("演示数据").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /事实来源/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /内容工作流/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /提示词实验/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /质量评测/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /人工终审/ })).toBeEnabled();
  });

  it("runs the demo workflow", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /立即体验示例/ }));
    fireEvent.click(screen.getByRole("button", { name: /内容工作流/ }));
    fireEvent.click(screen.getByRole("button", { name: "运行工作流" }));

    expect(await screen.findByText("四个步骤已完成", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getAllByText("已完成")).toHaveLength(4);
  });
});

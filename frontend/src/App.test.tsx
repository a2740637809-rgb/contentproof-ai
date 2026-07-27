import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(cleanup);

describe("SignalProof Studio", () => {
  it("states one evidence-to-brief job without unsupported scores", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /从零散反馈.*到有证据的内容简报/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /证据工作台/ })).toBeInTheDocument();
    expect(screen.queryByText("+18")).not.toBeInTheDocument();
  });

  it("analyzes editable source material and creates a traceable brief", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("反馈内容"), {
      target: { value: "最担心事实写错，也看不到内容来源。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "加入证据" }));
    fireEvent.click(screen.getByRole("button", { name: /分析 6 条证据/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "事实可信" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /生成内容简报/ }));
    expect(screen.getByRole("heading", { name: "内容简报" })).toBeInTheDocument();
    expect(screen.getAllByText(/原始证据/).length).toBeGreaterThan(0);
  });
});

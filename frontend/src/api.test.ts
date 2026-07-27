import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSignals } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("signal API fallback", () => {
  it("uses the backend response when the local API is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            mode: "rules-v1",
            signals: [
              {
                id: "S-001",
                theme: "事实可信",
                confidence: 0.8,
                rationale: "命中来源",
                action: "核验",
                evidence: [{ id: "E-001", channel: "访谈", text: "来源不清" }],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await analyzeSignals([
      { id: "E-001", channel: "访谈", text: "来源不清" },
    ]);

    expect(result.mode).toBe("rules-v1");
    expect(result.signals[0].theme).toBe("事实可信");
  });

  it("falls back explicitly when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await analyzeSignals([
      { id: "E-001", channel: "访谈", text: "内容来源不清" },
    ]);

    expect(result.mode).toBe("browser-rules");
    expect(result.fallbackReason).toBe("local-api-unavailable");
  });
});

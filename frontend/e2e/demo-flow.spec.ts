import { expect, test } from "@playwright/test";

test("visitor turns editable evidence into a traceable brief", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /从零散反馈/ })).toBeVisible();

  await page.getByLabel("反馈内容").fill("文章事实写错了，我需要看到原始来源。");
  await page.getByRole("button", { name: "加入证据" }).click();
  await page.getByRole("button", { name: /分析 6 条证据/ }).click();

  await expect(page.getByRole("heading", { name: "事实可信" })).toBeVisible();
  await expect(page.locator(".rationale")).toContainText("命中");
  await page.getByRole("button", { name: /生成内容简报/ }).click();

  await expect(page.getByRole("heading", { name: "内容简报" })).toBeVisible();
  await expect(page.getByText("原始证据 / 2")).toBeVisible();
  await expect(page.getByText(/当前公开演示使用规则基线/)).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

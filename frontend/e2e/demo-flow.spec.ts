import { expect, test } from "@playwright/test";

test("visitor completes the evidence workflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /立即体验示例/ }).click();
  await page.getByRole("button", { name: /内容工作流/ }).click();
  await page.getByRole("button", { name: "运行工作流" }).click();
  await expect(page.getByRole("status")).toContainText("四个步骤已完成");
  await expect(page.locator(".step b", { hasText: "已完成" })).toHaveCount(4);
  await page.getByRole("button", { name: /人工终审/ }).click();
  await page.getByRole("button", { name: "接受终稿" }).click();
  await expect(page.getByText("当前决定：")).toContainText("accepted");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

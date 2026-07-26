import { expect, test } from "@playwright/test";

test("visitor turns an audience signal into a measured decision", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /把用户声音变成/ })).toBeVisible();
  await page.getByRole("button", { name: /表达同质化/ }).click();
  await expect(page.getByRole("heading", { name: "表达同质化" })).toBeVisible();
  await page.getByRole("button", { name: /从最高机会创建内容简报/ }).click();
  await expect(page.getByText("✓ 简报已创建")).toBeVisible();
  await expect(page.getByText("证据 F002")).toBeVisible();
  await page.getByRole("button", { name: /进入内容实验/ }).click();
  await expect(page.getByRole("heading", { name: "内容实验" })).toBeVisible();
  await expect(page.getByText("接受 B：证据完整")).toBeVisible();
  await page.getByRole("button", { name: /完成决策闭环/ }).click();
  await expect(page.getByText("信号河流")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

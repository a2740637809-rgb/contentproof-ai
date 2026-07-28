import { expect, test, type Page } from "@playwright/test";

async function openSection(page: Page, name: string) {
  const mobileMenu = page.getByRole("button", { name: "打开导航" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
}

test("visitor opens a complete evidence-led research workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /从读者原话/ })).toBeVisible();

  await page.getByRole("button", { name: "加载完整示例" }).click();
  await expect(page.getByRole("heading", { name: "今天需要做出的编辑判断" })).toBeVisible();
  await expect(page.getByText("原始评论").first()).toBeVisible();

  await openSection(page, "运行轨迹");
  await expect(page.getByRole("heading", { name: "AI 如何得出这些主题" })).toBeVisible();
  await expect(page.getByText(/RUN-\d+/)).toBeVisible();

  await openSection(page, "方案对比");
  await expect(page.getByRole("heading", { name: "哪种分析方法更值得采用" })).toBeVisible();
  await expect(page.getByText("BASELINE / 基线")).toBeVisible();
  await expect(page.getByText("CURRENT / 当前方案")).toBeVisible();

  await openSection(page, "模型中心");
  await expect(page.getByRole("heading", { name: "选择谁来完成分析" })).toBeVisible();
  await expect(page.getByText("密钥不进入浏览器")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

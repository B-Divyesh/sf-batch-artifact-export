import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Batch Artifact Export/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
});

test("manifest inspection covers valid, error, and empty states", async ({ page }) => {
  await page.goto("/#contract");
  await page.getByRole("button", { name: "Inspect manifest" }).click();
  await expect(page.getByRole("heading", { name: "Structure looks sound" })).toBeVisible();
  await page.getByLabel("TOML manifest").fill("version = 1");
  await page.getByRole("button", { name: "Inspect manifest" }).click();
  await expect(page.getByRole("heading", { name: /items to fix/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear sheet" }).click();
  await page.getByRole("button", { name: "Inspect manifest" }).click();
  await expect(page.getByRole("heading", { name: "Nothing to inspect" })).toBeVisible();
});

test("install tabs work with arrow keys", async ({ page }) => {
  await page.goto("/#install");
  const first = page.getByRole("tab", { name: "macOS + Linux" });
  await first.focus();
  await first.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Windows" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Windows" })).toBeVisible();
});

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await page.goto("/");
  const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1);
  await expect(page.getByRole("link", { name: /releases|download/i }).first()).toBeVisible();
});

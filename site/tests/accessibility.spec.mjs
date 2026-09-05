import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const RELEASE_API = "https://api.github.com/repos/B-Divyesh/sf-batch-artifact-export/releases/latest";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const release = (tag = "v0.1.1") => ({
  tag_name: tag,
  assets: [
    { name: "latest.json", browser_download_url: `https://github.com/example/${tag}/latest.json` },
    { name: "batch-artifact-export-linux-x86_64.tar.gz", browser_download_url: `https://github.com/example/${tag}/linux.tar.gz` },
    { name: "batch-artifact-export-windows-x86_64.zip", browser_download_url: `https://github.com/example/${tag}/windows.zip` },
    { name: "batch-artifact-export-macos-universal.tar.gz", browser_download_url: `https://github.com/example/${tag}/macos.tar.gz` },
  ],
});

async function mockRelease(page, handler = (route) => route.fulfill({ json: release() })) {
  await page.route(RELEASE_API, handler);
}

test("first screen states the job, audience, and first action", async ({ page }) => {
  await mockRelease(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Batch Artifact Export — export many files at once");
  await expect(page.getByRole("heading", { level: 1, name: "Export many files with one command" })).toBeVisible();
  await expect(page.getByText(/technical writers, designers, and developers/i)).toBeVisible();
  const action = page.getByRole("button", { name: "Try it with sample data" });
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual((await page.viewportSize()).height);
});

test("landing page has no serious accessibility violations or console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await mockRelease(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("#release-state")).not.toHaveClass(/loading/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(errors).toEqual([]);
});

test("@claim:demo-sandbox loads, resets, and leaves isolated sample data", async ({ page }) => {
  await mockRelease(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Try it with sample data" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page).toHaveTitle("Demo — Batch Artifact Export");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://batch-artifact-export.sociobot.in/demo");
  await expect(page.getByText("Demo — sample data, nothing is saved")).toBeVisible();
  await expect(page.getByText("3 succeeded · 0 failed")).toBeVisible();
  await expect(page.getByText("release-notes.pdf", { exact: true })).toBeVisible();
  await expect(page.getByText("system-map.svg", { exact: true })).toBeVisible();
  await expect(page.getByText("app-icon.png", { exact: true })).toBeVisible();

  await page.getByLabel("TOML manifest").fill("changed sample");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByLabel("TOML manifest")).toContainText('source = "architecture/system.drawio"');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(["batch-artifact-export:release:v1"]);

  await page.getByRole("button", { name: "Start for real" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Sample data status")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Install from one verified command" })).toBeFocused();
});

test("@claim:manifest-local checks private text without sending it", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() || "" }));
  await mockRelease(page);
  await page.goto("/#contract");
  const privateMarker = "private-roadmap-2042.drawio";
  await page.getByLabel("TOML manifest").fill(`version = 1
output_dir = "exports"
report = "exports/report.json"
[[converters]]
name = "drawio"
command = "drawio"
args = ["{input}", "{output}"]
output_extension = "svg"
license = "Apache-2.0"
homepage = "https://www.drawio.com"
[[artifacts]]
source = "${privateMarker}"
converter = "drawio"`);
  await page.getByRole("button", { name: "Check manifest" }).click();
  await expect(page.getByRole("heading", { name: "Structure looks sound" })).toBeVisible();
  expect(requests.some((request) => request.method !== "GET" || request.body.includes(privateMarker))).toBe(false);
});

test("manifest inspection covers invalid and empty recovery", async ({ page }) => {
  await mockRelease(page);
  await page.goto("/#contract");
  await page.getByLabel("TOML manifest").fill("version = 1");
  await page.getByRole("button", { name: "Check manifest" }).click();
  await expect(page.getByRole("heading", { name: /items to fix/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear manifest" }).click();
  await page.getByRole("button", { name: "Check manifest" }).click();
  await expect(page.getByRole("heading", { name: "Nothing to check" })).toBeVisible();
});

test("@claim:release-cache-hour keeps release details for one hour and refreshes after expiry", async ({ page }) => {
  let requests = 0;
  await mockRelease(page, (route) => {
    requests += 1;
    return route.fulfill({ json: release(requests === 1 ? "v0.1.1" : "v0.1.2") });
  });
  await page.goto("/");
  await expect(page.locator("#release-state")).toContainText("v0.1.1");
  expect(requests).toBe(1);
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem("batch-artifact-export:release:v1")));
  expect(Date.now() - cached.savedAt).toBeLessThan(60_000);

  await page.reload();
  await expect(page.locator("#release-state")).toContainText("cached");
  expect(requests).toBe(1);

  await page.evaluate(() => {
    const key = "batch-artifact-export:release:v1";
    const value = JSON.parse(localStorage.getItem(key));
    value.savedAt = Date.now() - 3_600_001;
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload();
  await expect(page.locator("#release-state")).toContainText("v0.1.2");
  expect(requests).toBe(2);
});

test("built responses enforce security and immutable asset caching", async ({ request }) => {
  const home = await request.get("/");
  expect(home.status()).toBe(200);
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(home.headers()["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(home.headers()["referrer-policy"]).toBe("no-referrer");
  const html = await home.text();
  const scriptPath = html.match(/src="([^"]*app\.[a-f0-9]+\.js)"/)?.[1];
  expect(scriptPath).toBeTruthy();
  const script = await request.get(scriptPath);
  expect(script.headers()["cache-control"]).toContain("max-age=31536000");
  expect(script.headers()["cache-control"]).toContain("immutable");
  expect((await request.get("/_headers")).status()).toBe(404);
  expect((await request.get("/staticwebapp.config.json")).status()).toBe(404);
});

test("install tabs work with arrow keys", async ({ page }) => {
  await mockRelease(page);
  await page.goto("/#install");
  const first = page.getByRole("tab", { name: "macOS + Linux" });
  await first.focus();
  await first.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Windows" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Windows" })).toBeVisible();
});

test("legal pages and the custom 404 have route-specific structure", async ({ page }) => {
  for (const [path, title, heading] of [
    ["/privacy/", "Privacy — Batch Artifact Export", "How Batch Artifact Export handles data"],
    ["/terms/", "Terms — Batch Artifact Export", "Terms for Batch Artifact Export"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
  }
  const response = await page.goto("/missing-page");
  expect(response.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found — Batch Artifact Export");
  await expect(page.getByRole("heading", { level: 1, name: "This page does not exist" })).toBeVisible();
});

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await mockRelease(page);
  await page.goto("/demo");
  const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1);
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
});

test("reduced motion removes scrolling and entrance movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockRelease(page);
  await page.goto("/");
  const styles = await page.evaluate(() => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    animation: getComputedStyle(document.querySelector(".hero-figure picture")).animationName,
    transition: getComputedStyle(document.querySelector(".button")).transitionDuration,
  }));
  expect(styles).toEqual({ scrollBehavior: "auto", animation: "none", transition: "0s" });
});

test("demo reloads offline after the first visit", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await mockRelease(page);
  await page.goto(`${BASE_URL}/demo`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByText("Demo — sample data, nothing is saved")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("Demo — Batch Artifact Export");
  await expect(page.getByText("3 succeeded · 0 failed")).toBeVisible();
  await context.close();
});

test("@claim:site-privacy uses no cookies and sends sample text only to this page", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await mockRelease(page);
  await page.goto("/demo");
  await page.getByRole("button", { name: "Reset demo" }).click();
  expect(await page.context().cookies()).toEqual([]);
  expect(requests.every((url) => url.startsWith(`${BASE_URL}/`) || url === RELEASE_API)).toBe(true);
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  expect(Object.keys(storage)).toEqual(["batch-artifact-export:release:v1"]);
  expect(storage["batch-artifact-export:release:v1"]).not.toContain("architecture/system.drawio");
});

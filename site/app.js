import { validateManifest } from "./validator.mjs";

const RELEASE_API = "https://api.github.com/repos/B-Divyesh/sf-batch-artifact-export/releases/latest";
const RELEASE_PAGE = "https://github.com/B-Divyesh/sf-batch-artifact-export/releases/latest";
const RELEASE_CACHE_KEY = "batch-artifact-export:release:v1";
const RELEASE_CACHE_TTL_MS = 60 * 60 * 1000;
const HOME_TITLE = "Batch Artifact Export — export many files at once";
const DEMO_TITLE = "Demo — Batch Artifact Export";
const SAMPLE_MANIFEST = `version = 1
output_dir = "review"
report = "review/report.json"

[[converters]]
name = "diagram-svg"
command = "drawio"
args = ["--export", "--format", "svg", "--output", "{output}", "{input}"]
output_extension = "svg"
license = "Apache-2.0"
homepage = "https://www.drawio.com"

[[artifacts]]
source = "architecture/system.drawio"
converter = "diagram-svg"`;

function platformKey() {
  const value = `${navigator.userAgentData?.platform || navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  if (value.includes("win")) return ["windows-x86_64", "Windows"];
  if (value.includes("mac")) return ["macos-universal", "macOS"];
  return ["linux-x86_64", "Linux"];
}

function validRelease(metadata) {
  return Boolean(metadata?.tag_name && Array.isArray(metadata.assets) && metadata.assets.some((asset) => asset?.name === "latest.json"));
}

function readReleaseCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(RELEASE_CACHE_KEY) || "null");
    if (!Number.isFinite(cached?.savedAt) || !validRelease(cached?.metadata)) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeReleaseCache(metadata) {
  try {
    localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), metadata }));
  } catch {
    // A blocked or full localStorage must not block downloads.
  }
}

function showRelease(metadata, cached = false) {
  const button = document.querySelector("#download-button");
  const label = button.querySelector("span");
  const state = document.querySelector("#release-state");
  const [key, platform] = platformKey();
  const assetName = {
    "windows-x86_64": "batch-artifact-export-windows-x86_64.zip",
    "macos-universal": "batch-artifact-export-macos-universal.tar.gz",
    "linux-x86_64": "batch-artifact-export-linux-x86_64.tar.gz",
  }[key];
  const asset = metadata.assets.find((item) => item.name === assetName);
  if (!asset?.browser_download_url) throw new Error(`no ${key} asset in release index`);
  button.href = asset.browser_download_url;
  label.textContent = `Download for ${platform}`;
  state.className = "release-state ready";
  state.replaceChildren();
  const marker = document.createElement("span");
  marker.setAttribute("aria-hidden", "true");
  state.append(marker, document.createTextNode(`${metadata.tag_name} · SHA-256 published${cached ? " · cached" : ""}`));
}

function showReleaseFallback() {
  const button = document.querySelector("#download-button");
  const label = button.querySelector("span");
  const state = document.querySelector("#release-state");
  const [, platform] = platformKey();
  button.href = RELEASE_PAGE;
  label.textContent = `View ${platform} releases`;
  state.className = "release-state error";
  state.innerHTML = '<span aria-hidden="true"></span>Release details are unavailable. Open the release page when you are online.';
}

async function loadRelease() {
  const cached = readReleaseCache();
  if (cached && Date.now() - cached.savedAt < RELEASE_CACHE_TTL_MS) {
    try {
      showRelease(cached.metadata, true);
      return;
    } catch {
      // Fetch a clean copy when a cached release lacks this platform asset.
    }
  }
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`release API returned ${response.status}`);
    const metadata = await response.json();
    if (!validRelease(metadata)) throw new Error("latest.json is absent from the current release");
    showRelease(metadata);
    writeReleaseCache(metadata);
  } catch {
    if (cached) {
      try {
        showRelease(cached.metadata, true);
        return;
      } catch {
        // Continue to the release-page fallback.
      }
    }
    showReleaseFallback();
  }
}

function activateTab(tab) {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((item) => {
    const active = item === tab;
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    document.querySelector(`#panel-${item.dataset.tab}`).hidden = !active;
  });
}

document.querySelectorAll('[role="tab"]').forEach((tab, index, tabs) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    activateTab(tabs[next]);
    tabs[next].focus();
  });
});

document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = "Copied";
    document.querySelector("#copy-status").textContent = "Install command copied to clipboard.";
    window.setTimeout(() => { button.textContent = "Copy"; }, 1800);
  } catch {
    button.textContent = "Select text";
    button.previousElementSibling.focus?.();
    document.querySelector("#copy-status").textContent = "Clipboard access was blocked. Select the command manually.";
  }
}));

const input = document.querySelector("#manifest-input");
const result = document.querySelector("#validation-result");
function checkManifest() {
  const verdict = validateManifest(input.value);
  if (verdict.state === "empty") {
    result.innerHTML = '<span class="status-seal ready" aria-hidden="true">EMPTY</span><h3>Nothing to check</h3><p>Paste a manifest or reset the demo to restore the sample.</p>';
  } else if (verdict.state === "valid") {
    result.innerHTML = `<span class="status-seal pass" aria-hidden="true">PASS</span><h3>Structure looks sound</h3><p>Found ${verdict.converters} converter${verdict.converters === 1 ? "" : "s"} and ${verdict.artifacts} artifact${verdict.artifacts === 1 ? "" : "s"}. Run <code>batch-artifact-export check</code> to verify files and programs.</p>`;
  } else {
    result.innerHTML = `<span class="status-seal fail" aria-hidden="true">REVISE</span><h3>${verdict.errors.length} item${verdict.errors.length === 1 ? "" : "s"} to fix</h3><ul>${verdict.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
  }
}
document.querySelector("#validate-manifest").addEventListener("click", checkManifest);
document.querySelector("#clear-manifest").addEventListener("click", () => { input.value = ""; input.focus(); });
input.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = input.selectionStart;
  input.setRangeText("  ", start, input.selectionEnd, "end");
});

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

const demoSection = document.querySelector("#demo");
const demoBanner = document.querySelector("#demo-banner");
const routeStatus = document.querySelector("#route-status");
const canonical = document.querySelector('link[rel="canonical"]');
function showDemo({ updateHistory = true, focus = true } = {}) {
  demoSection.hidden = false;
  demoBanner.hidden = false;
  input.value = SAMPLE_MANIFEST;
  checkManifest();
  document.title = DEMO_TITLE;
  canonical.href = "https://batch-artifact-export.sociobot.in/demo";
  if (updateHistory && location.pathname !== "/demo") history.pushState({ demo: true }, "", "/demo");
  routeStatus.textContent = "Sample export loaded.";
  if (focus) {
    demoSection.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector("#demo-title").focus({ preventScroll: true });
  }
}

function leaveDemo({ updateHistory = true, focus = true } = {}) {
  demoSection.hidden = true;
  demoBanner.hidden = true;
  input.value = SAMPLE_MANIFEST;
  document.title = HOME_TITLE;
  canonical.href = "https://batch-artifact-export.sociobot.in/";
  if (updateHistory && location.pathname !== "/") history.pushState({ demo: false }, "", "/");
  routeStatus.textContent = "Demo closed. Install instructions are ready.";
  if (focus) {
    document.querySelector("#install").scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector("#install-title").setAttribute("tabindex", "-1");
    document.querySelector("#install-title").focus({ preventScroll: true });
  }
}

document.querySelector("#try-demo").addEventListener("click", () => showDemo());
document.querySelector("#reset-demo").addEventListener("click", () => showDemo({ updateHistory: false }));
document.querySelector("#leave-demo").addEventListener("click", () => leaveDemo());
window.addEventListener("popstate", () => {
  if (location.pathname === "/demo" || new URLSearchParams(location.search).get("demo") === "1") {
    showDemo({ updateHistory: false });
  } else {
    leaveDemo({ updateHistory: false, focus: false });
    document.querySelector("#hero-title").setAttribute("tabindex", "-1");
    document.querySelector("#hero-title").focus();
  }
});

if (location.pathname === "/demo" || new URLSearchParams(location.search).get("demo") === "1") {
  showDemo({ updateHistory: false, focus: false });
}
loadRelease();
if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

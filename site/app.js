import { validateManifest } from "./validator.mjs";

const RELEASE_API = "https://api.github.com/repos/B-Divyesh/sf-batch-artifact-export/releases/latest";
const RELEASE_PAGE = "https://github.com/B-Divyesh/sf-batch-artifact-export/releases/latest";

function platformKey() {
  const value = `${navigator.userAgentData?.platform || navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  if (value.includes("win")) return ["windows-x86_64", "Windows"];
  if (value.includes("mac")) return ["macos-universal", "macOS"];
  return ["linux-x86_64", "Linux"];
}

async function loadRelease() {
  const button = document.querySelector("#download-button");
  const label = button.querySelector("span");
  const state = document.querySelector("#release-state");
  const [key, platform] = platformKey();
  try {
    const metadataResponse = await fetch(RELEASE_API, { cache: "no-store" });
    if (!metadataResponse.ok) throw new Error(`release API returned ${metadataResponse.status}`);
    const metadata = await metadataResponse.json();
    if (!metadata.assets?.some((asset) => asset.name === "latest.json")) throw new Error("latest.json is absent from the current release");
    const assetName = { "windows-x86_64": "batch-artifact-export-windows-x86_64.zip", "macos-universal": "batch-artifact-export-macos-universal.tar.gz", "linux-x86_64": "batch-artifact-export-linux-x86_64.tar.gz" }[key];
    const asset = metadata.assets.find((item) => item.name === assetName);
    if (!asset?.browser_download_url) throw new Error(`no ${key} asset in release index`);
    button.href = asset.browser_download_url;
    label.textContent = `Download for ${platform}`;
    state.className = "release-state ready";
    state.innerHTML = `<span aria-hidden="true"></span>${metadata.tag_name} · SHA-256 published`;
  } catch {
    button.href = RELEASE_PAGE;
    label.textContent = `View ${platform} releases`;
    state.className = "release-state error";
    state.innerHTML = '<span aria-hidden="true"></span>Release index unavailable — installers can retry when online.';
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
document.querySelector("#validate-manifest").addEventListener("click", () => {
  const verdict = validateManifest(input.value);
  if (verdict.state === "empty") {
    result.innerHTML = '<span class="status-seal ready" aria-hidden="true">EMPTY</span><h3>Nothing to inspect</h3><p>Paste a manifest or reload the page to restore the working example.</p>';
  } else if (verdict.state === "valid") {
    result.innerHTML = `<span class="status-seal pass" aria-hidden="true">PASS</span><h3>Structure looks sound</h3><p>Found ${verdict.converters} converter${verdict.converters === 1 ? "" : "s"} and ${verdict.artifacts} artifact${verdict.artifacts === 1 ? "" : "s"}. Run <code>batch-artifact-export check</code> to verify files and executables.</p>`;
  } else {
    result.innerHTML = `<span class="status-seal fail" aria-hidden="true">REVISE</span><h3>${verdict.errors.length} item${verdict.errors.length === 1 ? "" : "s"} to fix</h3><ul>${verdict.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
  }
});
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

loadRelease();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});

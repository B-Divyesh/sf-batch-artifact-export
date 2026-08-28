import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [version, directory] = process.argv.slice(2);
if (!version || !directory) throw new Error("usage: node scripts/release-manifest.mjs VERSION DIRECTORY");
const repository = process.env.GITHUB_REPOSITORY || "B-Divyesh/sf-batch-artifact-export";
const sums = Object.fromEntries((await readFile(join(directory, "SHA256SUMS"), "utf8")).trim().split("\n").map((line) => {
  const [hash, name] = line.trim().split(/\s+/);
  return [name, hash];
}));
const names = {
  "linux-x86_64": "batch-artifact-export-linux-x86_64.tar.gz",
  "windows-x86_64": "batch-artifact-export-windows-x86_64.zip",
  "macos-universal": "batch-artifact-export-macos-universal.tar.gz"
};
const packages = {
  deb: Object.keys(sums).find((name) => name.endsWith(".deb")),
  rpm: Object.keys(sums).find((name) => name.endsWith(".rpm")),
  pkg: "batch-artifact-export-macos-universal.pkg"
};
const url = (name) => `https://github.com/${repository}/releases/download/${version}/${name}`;
const assets = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, { name, url: url(name), sha256: sums[name] }]));
const packageAssets = Object.fromEntries(Object.entries(packages).filter(([, name]) => name).map(([key, name]) => [key, { name, url: url(name), sha256: sums[name] }]));
await writeFile(join(directory, "latest.json"), `${JSON.stringify({ version, assets, packages: packageAssets }, null, 2)}\n`);

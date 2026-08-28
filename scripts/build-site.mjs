import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";

const source = new URL("../site/", import.meta.url);
const destination = new URL("../dist/site/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const files = (await walk(source.pathname)).filter((file) => !file.includes("/tests/") && !file.endsWith(".png") && !file.endsWith(".json"));
const assets = files.filter((file) => [".css", ".js", ".mjs", ".webp", ".woff2"].includes(extname(file)));
const replacements = new Map();

// Asset references are updated before their own hash is calculated, fonts/images first.
for (const extension of [".woff2", ".webp", ".mjs", ".js", ".css"]) {
  for (const file of assets.filter((item) => extname(item) === extension)) {
    let bytes = await readFile(file);
    if ([".css", ".js", ".mjs"].includes(extension)) bytes = Buffer.from(replaceAll(bytes.toString(), replacements));
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
    const rel = relative(source.pathname, file).replaceAll("\\", "/");
    const outRel = rel.replace(new RegExp(`${extension.replace(".", "\\.")}$`), `.${hash}${extension}`);
    replacements.set(rel, outRel);
    replacements.set(rel.split("/").at(-1), outRel.split("/").at(-1));
    await mkdir(dirname(join(destination.pathname, outRel)), { recursive: true });
    await writeFile(join(destination.pathname, outRel), bytes);
  }
}

for (const file of files.filter((item) => !assets.includes(item))) {
  const rel = relative(source.pathname, file);
  let bytes = await readFile(file);
  if (extname(file) === ".html") bytes = Buffer.from(replaceAll(bytes.toString(), replacements));
  await mkdir(dirname(join(destination.pathname, rel)), { recursive: true });
  await writeFile(join(destination.pathname, rel), bytes);
}

for (const installer of ["install.sh", "install.ps1"]) await cp(new URL(`../${installer}`, import.meta.url), new URL(installer, destination));

const precache = (await walk(destination.pathname)).map((file) => `/${relative(destination.pathname, file).replaceAll("\\", "/")}`).filter((path) => !path.endsWith("sw.js"));
const version = createHash("sha256").update(precache.join("|")).digest("hex").slice(0, 12);
await writeFile(new URL("sw.js", destination), `const CACHE="bae-${version}";const ASSETS=${JSON.stringify(precache)};self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{if(new URL(e.request.url).origin===location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html"))))});\n`);
await writeFile(new URL("_headers", destination), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*.js\n  Cache-Control: public, max-age=31536000, immutable\n/install.sh\n  Cache-Control: public, max-age=300\n/install.ps1\n  Cache-Control: public, max-age=300\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https://github.com https://objects.githubusercontent.com https://release-assets.githubusercontent.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n`);

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(root, entry.name)) : [join(root, entry.name)]));
  return nested.flat();
}
function replaceAll(text, values) {
  return [...values.entries()].sort((a, b) => b[0].length - a[0].length).reduce((value, [from, to]) => value.replaceAll(from, to), text);
}

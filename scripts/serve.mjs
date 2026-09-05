import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../dist/site/", import.meta.url).pathname;
const config = JSON.parse(await readFile(join(root, "staticwebapp.config.json"), "utf8"));
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".ps1": "text/plain; charset=utf-8",
  ".sh": "text/x-shellscript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function routeMatches(pattern, pathname) {
  if (pattern.endsWith("*")) return pathname.startsWith(pattern.slice(0, -1));
  return pattern === pathname;
}

createServer(async (request, response) => {
  const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const route = config.routes.find((item) => routeMatches(item.route, requested));
  const pathname = route?.rewrite || requested;
  let statusCode = 200;
  let path = normalize(join(root, pathname));
  try {
    if (!path.startsWith(root) || requested === "/staticwebapp.config.json" || requested === "/_headers") throw new Error("not public");
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
  } catch {
    statusCode = 404;
    path = join(root, config.responseOverrides?.["404"]?.rewrite || "/404.html");
  }
  const headers = {
    ...config.globalHeaders,
    ...route?.headers,
    "Content-Type": types[extname(path)] || "application/octet-stream",
  };
  response.writeHead(statusCode, headers);
  if (request.method === "HEAD") return response.end();
  response.end(await readFile(path));
}).listen(4173, "127.0.0.1", () => console.log("Site: http://127.0.0.1:4173"));

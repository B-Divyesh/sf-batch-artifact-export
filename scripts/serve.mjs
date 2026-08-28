import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../site/", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".webp": "image/webp", ".woff2": "font/woff2" };
createServer(async (request, response) => {
  try {
    let path = normalize(join(root, decodeURIComponent(new URL(request.url, "http://localhost").pathname)));
    if (!path.startsWith(root)) throw new Error("outside root");
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
    response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end("Not found"); }
}).listen(4173, "127.0.0.1", () => console.log("Site: http://127.0.0.1:4173"));

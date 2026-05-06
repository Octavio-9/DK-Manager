import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

const port = Number(getArg("--port", "5173"));
const host = getArg("--host", "127.0.0.1");
const root = path.resolve(__dirname, "..", getArg("--root", "dist"));

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function safeJoin(base, target) {
  const resolved = path.resolve(base, "." + target);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

async function readFileIfExists(filePath) {
  try {
    const data = await fs.readFile(filePath);
    return data;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const filePath = safeJoin(root, pathname === "/" ? "/index.html" : pathname);
    if (!filePath) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    // Try direct file first.
    let body = await readFileIfExists(filePath);

    // SPA fallback: serve index.html for unknown routes (but not for obvious asset paths).
    if (!body && !path.extname(filePath)) {
      body = await readFileIfExists(path.join(root, "index.html"));
    }

    if (!body) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath) || ".html";
    res.setHeader("Content-Type", contentTypes.get(ext) ?? "application/octet-stream");
    res.statusCode = 200;
    res.end(body);
  } catch {
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving ${root} at http://${host}:${port}`);
});


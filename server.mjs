/*
  Amal Souss Sportive — production/preview server with content-editing API.
  - Serves the built app from ./dist (SPA fallback to index.html).
  - GET    /api/content/:lang  -> override file ./data/:lang.json (404 if none)
  - POST   /api/content/:lang  -> saves edited JSON permanently (password check is client-side demo)
  - DELETE /api/content/:lang  -> removes override, site falls back to bundled content

  Usage:
    npm run build
    npm start    (port 3000, override with PORT env var)
*/
import http from "node:http";
import { promises as fs } from "node:fs";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const DATA = join(ROOT, "data");
const LANGS = new Set(["ar", "fr", "en"]);
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = decodeURIComponent(url.pathname);

  /* ---------- Content API ---------- */
  if (path.startsWith("/api/content/")) {
    const lang = path.split("/")[3] || "";
    if (!LANGS.has(lang)) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Unknown language");
      return;
    }
    const file = join(DATA, `${lang}.json`);

    if (req.method === "GET") {
      try {
        const data = await fs.readFile(file, "utf8");
        res.writeHead(200, { "content-type": MIME[".json"] });
        res.end(data);
      } catch {
        res.writeHead(404, { "content-type": "application/json" });
        res.end('{"error":"no override"}');
      }
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 3e6) req.destroy();
      });
      req.on("end", async () => {
        try {
          JSON.parse(body);
        } catch {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("Invalid JSON");
          return;
        }
        await fs.mkdir(DATA, { recursive: true }).catch(() => {});
        await fs.writeFile(file, body, "utf8");
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"ok":true}');
      });
      return;
    }

    if (req.method === "DELETE") {
      await fs.unlink(file).catch(() => {});
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true,"reset":true}');
      return;
    }

    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  /* ---------- Static dist + SPA fallback ---------- */
  const rel = path === "/" ? "/index.html" : path;
  const file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    const index = await fs.readFile(join(DIST, "index.html")).catch(() => null);
    if (!index) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("dist/ is missing — run: npm run build");
      return;
    }
    res.writeHead(200, { "content-type": MIME[".html"] });
    res.end(index);
  }
});

server.listen(PORT, () => {
  console.log(`Amal Souss Sportive is running:  http://localhost:${PORT}`);
  console.log(`Admin area:                      http://localhost:${PORT}/admin`);
});

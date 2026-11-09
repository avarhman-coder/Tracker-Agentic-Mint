// Server Node polos (tanpa dependensi) untuk menjalankan tracker ini di
// hosting mana pun yang menyediakan Node.js: VPS, Render, Railway, Fly,
// atau komputer sendiri.
//
//   node server.mjs            (port dari env PORT, bawaan 3000)
//
// Menyajikan index.html + berkas statis dari folder ini, dan meneruskan
// rute /api/* ke handler yang sama dengan versi Vercel di folder api/.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const routes = {};
for (const name of ["feed", "detail", "jagent", "prices", "mintcost"]) {
  routes["/api/" + name] = (await import("./api/" + name + ".js")).default;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const handler = routes[url.pathname];
    if (handler) {
      const webRes = await handler(new Request(url, { method: req.method, headers: req.headers }));
      res.writeHead(webRes.status, Object.fromEntries(webRes.headers));
      res.end(await webRes.text());
      return;
    }
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(ROOT, "." + decodeURIComponent(path)));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": TYPES[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
});

server.listen(PORT, () => console.log("Agentic Mint Tracker jalan di port " + PORT));

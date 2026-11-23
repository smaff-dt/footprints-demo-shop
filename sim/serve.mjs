// A local stand-in for GitHub Pages, for testing: serves docs/ and, like Pages,
// answers /cart with cart.html. Usage: node sim/serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "docs");
const port = Number(process.argv[2] || 8300);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  if (path.endsWith("/")) path += "index.html";
  const candidates = extname(path) ? [path] : [path + ".html", path + "/index.html"];
  for (const c of candidates) {
    try {
      const body = await readFile(join(root, c));
      res.writeHead(200, { "content-type": types[extname(c)] || "application/octet-stream" });
      res.end(body);
      return;
    } catch {
      // try the next
    }
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}).listen(port, () => console.log(`Demo shop on http://localhost:${port}/`));

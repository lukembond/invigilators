import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const distDir = resolve("dist");
const port = Number(process.env.PORT || 4321);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const getFilePath = async (pathname) => {
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
  const filePath = resolve(distDir, relativePath);
  if (filePath !== distDir && !filePath.startsWith(`${distDir}${sep}`)) return null;

  try {
    return (await stat(filePath)).isDirectory() ? join(filePath, "index.html") : filePath;
  } catch {
    return null;
  }
};

createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const filePath = await getFilePath(pathname);
  if (!filePath) {
    response.writeHead(404).end();
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving dist at http://127.0.0.1:${port}`);
});
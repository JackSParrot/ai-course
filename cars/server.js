// Servidor local mínimo, utilizando solo módulos incluidos en Node.js.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const sharedResources = new Set(["/i18n/i18n.js", "/i18n/en.js", "/i18n/dom.js", "/i18n/language.css"]);
const port = Number(process.env.PORT || 5173);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const shared = sharedResources.has(pathname);
    const filename = shared
      ? path.resolve(root, "..", "." + pathname)
      : path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    const relative = path.relative(root, filename);
    if (!shared && (relative.startsWith("..") || path.isAbsolute(relative))) {
      response.writeHead(403);
      response.end("Acceso no permitido");
      return;
    }
    let content = await readFile(filename);
    if (filename === path.join(root, "index.html")) {
      content = Buffer.from(content.toString("utf8").replace("</head>", '<link rel="stylesheet" href="/i18n/language.css"><script type="module" src="/i18n/dom.js"></script></head>'));
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404);
    response.end("No se ha encontrado el archivo");
  }
});

server.on("error", error => {
  console.error(error.code === "EADDRINUSE" ? `El puerto ${port} está ocupado. Usa otro valor en PORT.` : error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Neural Racing disponible en http://127.0.0.1:${port}`);
});

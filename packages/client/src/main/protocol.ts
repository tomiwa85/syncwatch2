import { createReadStream, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { Readable } from "node:stream";
import { protocol } from "electron";

export const LOCAL_VIDEO_SCHEME = "sw-video";

// The renderer is served from a real origin (app://bundle/…) rather than file://.
// A proper tuple origin is required for embedded players like YouTube, whose
// IFrame API postMessage handshake rejects the opaque "null" origin of file://.
export const APP_SCHEME = "app";
const APP_HOST = "bundle";

function contentTypeForAsset(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Serve the built renderer over app://bundle/… from `rendererDir`. */
export function registerAppProtocol(rendererDir: string) {
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    // Only our own host; ignore anything else.
    if (url.hostname !== APP_HOST) return new Response("Not found", { status: 404 });

    // Map the path to a file inside rendererDir, guarding against traversal.
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const target = normalize(join(rendererDir, rel));
    if (!target.startsWith(normalize(rendererDir))) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const body = readFileSync(target);
      return new Response(body, { headers: { "Content-Type": contentTypeForAsset(target) } });
    } catch {
      // SPA fallback: unknown non-asset paths serve index.html.
      try {
        const html = readFileSync(join(rendererDir, "index.html"));
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }
  });
}

// The currently authorized local file path. Only a file the user explicitly
// picked via the native dialog (or its converted copy) can be streamed.
let authorizedPath: string | null = null;

export function setAuthorizedLocalVideo(path: string | null) {
  authorizedPath = path;
}

function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (ext === ".webm") return "video/webm";
  if (ext === ".ogv") return "video/ogg";
  return "video/mp4";
}

export function registerLocalVideoProtocol() {
  protocol.handle(LOCAL_VIDEO_SCHEME, (request) => {
    const path = authorizedPath;
    if (!path) return new Response("No authorized video", { status: 403 });

    let size: number;
    try {
      size = statSync(path).size;
    } catch {
      return new Response("Video not found", { status: 404 });
    }

    const type = contentTypeFor(path);
    const range = request.headers.get("Range");

    // Range request → 206 Partial Content so the <video> can seek efficiently.
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match ? Number(match[1]) : 0;
      const end = match && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const stream = createReadStream(path, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
        },
      });
    }

    // Full response.
    const stream = createReadStream(path);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
      },
    });
  });
}

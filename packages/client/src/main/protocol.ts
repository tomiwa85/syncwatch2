import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { protocol } from "electron";

export const LOCAL_VIDEO_SCHEME = "sw-video";

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

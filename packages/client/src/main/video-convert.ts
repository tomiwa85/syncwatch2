import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { LOCAL_VIDEO_SCHEME, setAuthorizedLocalVideo } from "./protocol.js";

// Containers/codecs Chromium can usually play directly (no conversion needed).
const NATIVE_EXT = new Set([".mp4", ".m4v", ".webm", ".mov"]);

function resolveFfmpeg(): string | undefined {
  const candidates = [
    join(__dirname, "../../resources/ffmpeg/ffmpeg.exe"),
    join(process.resourcesPath ?? "", "ffmpeg/ffmpeg.exe"),
    join(process.cwd(), "resources/ffmpeg/ffmpeg.exe"),
  ];
  return candidates.find((p) => existsSync(p));
}

function extname(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i).toLowerCase() : "";
}

// Remux to MP4: copy the video stream (instant, no quality loss — works for the
// very common H.264 case) and re-encode audio to AAC so the browser can play it.
function remuxToMp4(input: string, output: string): Promise<void> {
  const ff = resolveFfmpeg();
  if (!ff) return Promise.reject(new Error("Video converter (ffmpeg) is missing from the app."));
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ff,
      ["-y", "-i", input, "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", output],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
    });
    proc.on("error", (e) => reject(new Error(`Could not start the converter: ${e.message}`)));
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("This video's format couldn't be prepared (its codec may be unsupported)."));
    });
  });
}

export function registerVideoConvert(): void {
  ipcMain.handle("video:prepare", async (_e, filePath: string): Promise<{ playbackUrl: string }> => {
    const bust = Date.now();
    const url = () => `${LOCAL_VIDEO_SCHEME}://local/video?t=${bust}`;

    // Directly playable → serve the original file.
    if (NATIVE_EXT.has(extname(filePath))) {
      setAuthorizedLocalVideo(filePath);
      return { playbackUrl: url() };
    }

    // Otherwise convert once, cached by file identity, and serve the result.
    const cacheDir = join(app.getPath("temp"), "syncwatch-convert");
    await mkdir(cacheDir, { recursive: true });
    const info = await stat(filePath);
    const key = createHash("sha1").update(`${filePath}:${info.size}:${info.mtimeMs}`).digest("hex").slice(0, 16);
    const out = join(cacheDir, `${key}.mp4`);

    if (!existsSync(out)) {
      await remuxToMp4(filePath, out);
    }
    setAuthorizedLocalVideo(out);
    return { playbackUrl: url() };
  });
}

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { app, ipcMain, type WebContents } from "electron";
import { LOCAL_VIDEO_SCHEME, setAuthorizedLocalVideo } from "./protocol.js";

// Codecs Chromium (Electron) can play in an HTML5 <video>.
const SUPPORTED_VIDEO = new Set(["h264", "vp8", "vp9", "av1"]);
const SUPPORTED_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "flac"]);
// Containers Chromium can open directly (so if the codecs are fine too, no remux).
const NATIVE_EXT = new Set([".mp4", ".m4v", ".webm", ".mov"]);

/** Raised when a file's video codec can't be played and we don't transcode it. */
class UnsupportedVideoError extends Error {
  constructor(public codec: string) {
    super(
      codec === "hevc" || codec === "h265"
        ? "This video is HEVC (H.265) and your device can't decode it. Please use an H.264 copy."
        : `This video uses the “${codec}” video codec, which isn't supported. Please use an H.264 copy.`,
    );
  }
}

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

interface MediaInfo {
  videoCodec: string;
  audioCodec: string | null;
  durationSec: number;
}

// Inspect a file's codecs by parsing `ffmpeg -i` output (no separate ffprobe
// binary needed). This only reads the header, so it's fast even for huge files.
function probeMedia(ff: string, input: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ff, ["-hide_banner", "-i", input], { stdio: ["ignore", "ignore", "pipe"] });
    let out = "";
    proc.stderr?.on("data", (d) => (out += d.toString()));
    proc.on("error", (e) => reject(new Error(`Could not start the converter: ${e.message}`)));
    // `ffmpeg -i` with no output exits non-zero but prints the stream info we need.
    proc.on("exit", () => {
      const video = /Stream #\d+:\d+.*?: Video: (\w+)/.exec(out);
      const audio = /Stream #\d+:\d+.*?: Audio: (\w+)/.exec(out);
      const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(out);
      if (!video) return reject(new Error("Couldn't read this file — it may be corrupt or not a video."));
      const durationSec = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
      resolve({ videoCodec: video[1].toLowerCase(), audioCodec: audio ? audio[1].toLowerCase() : null, durationSec });
    });
  });
}

function sendProgress(wc: WebContents, phase: string, percent: number | null) {
  if (!wc.isDestroyed()) wc.send("video:prepare-progress", { phase, percent });
}

// Remux to MP4: copy the (supported) video stream untouched, and copy the audio
// too when it's already browser-friendly — otherwise transcode just the audio to
// AAC. Reports progress by matching ffmpeg's `time=` against the total duration.
function remuxToMp4(ff: string, info: MediaInfo, input: string, output: string, wc: WebContents): Promise<void> {
  const audioArgs =
    info.audioCodec && SUPPORTED_AUDIO.has(info.audioCodec) ? ["-c:a", "copy"] : ["-c:a", "aac"];
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ff,
      ["-y", "-i", input, "-c:v", "copy", ...audioArgs, "-movflags", "+faststart", output],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
      const t = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
      if (t && info.durationSec > 0) {
        const done = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
        sendProgress(wc, "preparing", Math.min(99, Math.round((done / info.durationSec) * 100)));
      }
    });
    proc.on("error", (e) => reject(new Error(`Could not start the converter: ${e.message}`)));
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("This video's format couldn't be prepared (its codec may be unsupported)."));
    });
  });
}

export function registerVideoConvert(): void {
  ipcMain.handle(
    "video:prepare",
    async (e, filePath: string, opts?: { allowHevc?: boolean }): Promise<{ playbackUrl: string }> => {
    const bust = Date.now();
    const url = () => `${LOCAL_VIDEO_SCHEME}://local/video?t=${bust}`;
    const wc = e.sender;
    const ff = resolveFfmpeg();
    if (!ff) throw new Error("Video converter (ffmpeg) is missing from the app.");

    // 1) Inspect the actual codecs (fast — header only), not just the extension.
    sendProgress(wc, "analyzing", null);
    const info = await probeMedia(ff, filePath);

    // 2) HEVC is playable only if the OS/hardware can decode it (the renderer tells
    //    us via canPlayType). If so we just remux; otherwise we can't play it.
    const supportedVideo = opts?.allowHevc ? new Set([...SUPPORTED_VIDEO, "hevc", "h265"]) : SUPPORTED_VIDEO;
    if (!supportedVideo.has(info.videoCodec)) throw new UnsupportedVideoError(info.videoCodec);

    // 3) Native container + supported codecs → play the original, no conversion.
    const nativeContainer = NATIVE_EXT.has(extname(filePath));
    const audioOk = !info.audioCodec || SUPPORTED_AUDIO.has(info.audioCodec);
    if (nativeContainer && audioOk) {
      setAuthorizedLocalVideo(filePath);
      return { playbackUrl: url() };
    }

    // 4) Otherwise remux (video copy; audio copy or → AAC), cached by file identity.
    const cacheDir = join(app.getPath("temp"), "syncwatch-convert");
    await mkdir(cacheDir, { recursive: true });
    const meta = await stat(filePath);
    const key = createHash("sha1")
      .update(`${filePath}:${meta.size}:${meta.mtimeMs}:v2`)
      .digest("hex")
      .slice(0, 16);
    const out = join(cacheDir, `${key}.mp4`);

    if (!existsSync(out)) {
      await remuxToMp4(ff, info, filePath, out, wc);
    }
    sendProgress(wc, "starting", 100);
    setAuthorizedLocalVideo(out);
    return { playbackUrl: url() };
  });
}

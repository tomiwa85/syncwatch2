export interface PickedVideo {
  fileName: string;
  fileSize: number;
  /** URL the <video> element can load (sw-video:// in Electron, blob: in browser). */
  playbackUrl: string;
  /** Absolute filesystem path (Electron only; absent in browser). */
  filePath?: string;
}

interface SyncwatchBridge {
  pickVideoFile: () => Promise<PickedVideo | null>;
  prepareVideo: (filePath: string) => Promise<{ playbackUrl: string }>;
}

function getBridge(): SyncwatchBridge | undefined {
  return (window as unknown as { syncwatch?: SyncwatchBridge }).syncwatch;
}

/** True in the packaged Electron app (native dialog + sw-video:// protocol available). */
export function hasNativePicker(): boolean {
  return typeof getBridge()?.pickVideoFile === "function";
}

/**
 * Ensures a picked local file is playable, converting it (e.g. MKV/AVI) if the
 * browser engine can't play it directly. Returns the final playback URL.
 * Only meaningful in Electron; in the browser we just use the blob URL.
 */
export async function prepareForPlayback(picked: PickedVideo): Promise<string> {
  const bridge = getBridge();
  if (bridge?.prepareVideo && picked.filePath) {
    const { playbackUrl } = await bridge.prepareVideo(picked.filePath);
    return playbackUrl;
  }
  return picked.playbackUrl;
}

// Browser fallback: a hidden file input yields a real File (name + size) and a
// blob URL for playback. Lets the app run — and be tested — outside Electron.
function pickViaInput(): Promise<PickedVideo | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    // `video/*` excludes .mkv (video/x-matroska) on many systems, so list
    // common extensions explicitly too.
    input.accept = "video/*,.mkv,.avi,.wmv,.flv,.mov,.m4v,.ts,.m2ts,.mpg,.mpeg,.webm,.mp4,.ogv,.3gp";
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return resolve(null);
      resolve({ fileName: file.name, fileSize: file.size, playbackUrl: URL.createObjectURL(file) });
    };
    // If the dialog is cancelled there is no reliable event; clean up on focus.
    window.addEventListener(
      "focus",
      () => setTimeout(() => input.parentNode && !input.files?.length && (document.body.removeChild(input), resolve(null)), 500),
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickVideo(): Promise<PickedVideo | null> {
  const bridge = getBridge();
  if (bridge?.pickVideoFile) return bridge.pickVideoFile();
  return pickViaInput();
}

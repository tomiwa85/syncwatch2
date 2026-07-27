export interface PickedVideo {
  fileName: string;
  fileSize: number;
  /** URL the <video> element can load (sw-video:// in Electron, blob: in browser). */
  playbackUrl: string;
}

interface SyncwatchBridge {
  pickVideoFile: () => Promise<PickedVideo | null>;
}

function getBridge(): SyncwatchBridge | undefined {
  return (window as unknown as { syncwatch?: SyncwatchBridge }).syncwatch;
}

/** True in the packaged Electron app (native dialog + sw-video:// protocol available). */
export function hasNativePicker(): boolean {
  return typeof getBridge()?.pickVideoFile === "function";
}

// Browser fallback: a hidden file input yields a real File (name + size) and a
// blob URL for playback. Lets the app run — and be tested — outside Electron.
function pickViaInput(): Promise<PickedVideo | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
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

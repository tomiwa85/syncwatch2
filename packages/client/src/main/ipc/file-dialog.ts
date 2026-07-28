import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { dialog, ipcMain } from "electron";
import { LOCAL_VIDEO_SCHEME, setAuthorizedLocalVideo } from "../protocol.js";

export interface PickedVideo {
  fileName: string;
  fileSize: number;
  playbackUrl: string;
  /** Absolute filesystem path — used by the mpv player (Electron only). */
  filePath?: string;
}

// mpv plays essentially everything; this list just makes the "Video" filter
// convenient. "All Files" is always available.
const VIDEO_EXTENSIONS = [
  "mp4", "mkv", "webm", "mov", "avi", "m4v", "wmv", "flv", "mpg", "mpeg",
  "ts", "m2ts", "mts", "vob", "ogv", "ogm", "3gp", "divx", "f4v", "rmvb", "asf",
];

export function registerFileDialogHandlers() {
  ipcMain.handle("dialog:pick-video", async (): Promise<PickedVideo | null> => {
    const result = await dialog.showOpenDialog({
      title: "Choose a video file",
      properties: ["openFile"],
      filters: [
        { name: "Video", extensions: VIDEO_EXTENSIONS },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const info = await stat(filePath);
    setAuthorizedLocalVideo(filePath);

    return {
      fileName: basename(filePath),
      fileSize: info.size,
      playbackUrl: `${LOCAL_VIDEO_SCHEME}://local/video`,
      filePath,
    };
  });
}

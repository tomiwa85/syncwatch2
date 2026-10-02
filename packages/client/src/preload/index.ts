import { contextBridge, ipcRenderer } from "electron";

export interface PickedVideo {
  fileName: string;
  fileSize: number;
  playbackUrl: string;
  filePath?: string;
}

export interface PrepareProgress {
  phase: "analyzing" | "preparing" | "starting";
  percent: number | null;
}

const api = {
  pickVideoFile: (): Promise<PickedVideo | null> => ipcRenderer.invoke("dialog:pick-video"),
  // Prepares a picked local file for playback: plays it directly if the browser
  // engine supports it, otherwise converts it (e.g. MKV/AVI) and returns a URL.
  prepareVideo: (filePath: string, opts?: { allowHevc?: boolean }): Promise<{ playbackUrl: string }> =>
    ipcRenderer.invoke("video:prepare", filePath, opts),
  // Subscribe to conversion progress; returns an unsubscribe function.
  onPrepareProgress: (cb: (p: PrepareProgress) => void): (() => void) => {
    const listener = (_e: unknown, data: PrepareProgress) => cb(data);
    ipcRenderer.on("video:prepare-progress", listener);
    return () => ipcRenderer.removeListener("video:prepare-progress", listener);
  },
};

contextBridge.exposeInMainWorld("syncwatch", api);

export type SyncwatchApi = typeof api;

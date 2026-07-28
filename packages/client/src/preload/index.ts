import { contextBridge, ipcRenderer } from "electron";

export interface PickedVideo {
  fileName: string;
  fileSize: number;
  playbackUrl: string;
  filePath?: string;
}

const api = {
  pickVideoFile: (): Promise<PickedVideo | null> => ipcRenderer.invoke("dialog:pick-video"),
  // Prepares a picked local file for playback: plays it directly if the browser
  // engine supports it, otherwise converts it (e.g. MKV/AVI) and returns a URL.
  prepareVideo: (filePath: string): Promise<{ playbackUrl: string }> =>
    ipcRenderer.invoke("video:prepare", filePath),
};

contextBridge.exposeInMainWorld("syncwatch", api);

export type SyncwatchApi = typeof api;

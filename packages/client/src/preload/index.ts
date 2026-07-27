import { contextBridge, ipcRenderer } from "electron";

export interface PickedVideo {
  fileName: string;
  fileSize: number;
  playbackUrl: string;
}

const api = {
  pickVideoFile: (): Promise<PickedVideo | null> => ipcRenderer.invoke("dialog:pick-video"),
};

contextBridge.exposeInMainWorld("syncwatch", api);

export type SyncwatchApi = typeof api;

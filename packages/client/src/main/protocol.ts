import { protocol, net } from "electron";
import { pathToFileURL } from "node:url";

export const LOCAL_VIDEO_SCHEME = "sw-video";

// The currently authorized local file path. Only a file the user explicitly
// picked via the native dialog can be streamed through the protocol.
let authorizedPath: string | null = null;

export function setAuthorizedLocalVideo(path: string | null) {
  authorizedPath = path;
}

export function registerLocalVideoProtocol() {
  protocol.handle(LOCAL_VIDEO_SCHEME, (request) => {
    if (!authorizedPath) {
      return new Response("No authorized video", { status: 403 });
    }
    return net.fetch(pathToFileURL(authorizedPath).toString());
  });
}

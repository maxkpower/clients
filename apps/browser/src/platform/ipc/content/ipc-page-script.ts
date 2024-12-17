import { BitwardenIpcWebApi, IpcMessage } from "./bitwarden-ipc-web-api";

(window as any).Bitwarden = {
  postMessage: (payload) =>
    window.postMessage(
      { type: "bitwarden-ipc-message", payload } as IpcMessage,
      window.location.origin,
    ),
  onMessage: undefined,
} as BitwardenIpcWebApi;

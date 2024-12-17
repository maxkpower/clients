import { IpcService, isIpcMessage } from "@bitwarden/common/platform/ipc";

export class WebIpcService extends IpcService {
  override async init() {
    await super.init();

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!isIpcMessage(message)) {
        return;
      }

      console.log("WEB Received IPC message", message);
    });
  }
}

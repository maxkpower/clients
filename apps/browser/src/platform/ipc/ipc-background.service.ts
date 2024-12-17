import { IpcService, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { BrowserApi } from "../browser/browser-api";

export class IpcBackgroundService extends IpcService {
  override async init() {
    await super.init();

    BrowserApi.messageListener("platform.ipc", (message) => {
      if (!isIpcMessage(message)) {
        return;
      }

      console.log("Received IPC message", message);
    });
  }
}

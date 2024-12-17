import { IpcService } from "@bitwarden/platform";

import { BrowserApi } from "../browser/browser-api";

import { isIpcMessage } from "./content/bitwarden-ipc-web-api";

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

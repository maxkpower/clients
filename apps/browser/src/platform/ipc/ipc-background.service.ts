import { Observable } from "rxjs";

import { IpcLink, IpcMessage, IpcService, isIpcMessage } from "@bitwarden/common/platform/ipc";

import { BrowserApi } from "../browser/browser-api";

export class IpcBackgroundService extends IpcService {
  private links = new Map<string, IpcLink>();

  override async init() {
    await super.init();

    BrowserApi.messageListener("platform.ipc", (message, sender) => {
      if (!isIpcMessage(message)) {
        return;
      }

      if (!this.links.has(sender.documentId)) {
        this.links.set(
          sender.documentId,
          new IpcLink(
            async (data) =>
              BrowserApi.sendMessage("platform.ipc", {
                type: "bitwarden-ipc-message",
                payload: data,
              } satisfies IpcMessage),
            new Observable((subscriber) => {
              const handler = (message: unknown) => {
                if (!isIpcMessage(message)) {
                  return;
                }
                subscriber.next(message.payload);
              };

              BrowserApi.addListener(chrome.runtime.onMessage, handler);

              return () => BrowserApi.removeListener(chrome.runtime.onMessage, handler);
            }),
            [{ Web: sender.documentId }],
          ),
        );
      }
    });
  }
}

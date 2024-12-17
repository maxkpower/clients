import { Observable } from "rxjs";

import {
  IpcLink,
  IpcService,
  isIpcMessage,
  PingMessagePayload,
  PongMessagePayload,
} from "@bitwarden/common/platform/ipc";

export class WebIpcService extends IpcService {
  private static LinkToExtensionBackground = new IpcLink(
    async (data) => window.postMessage(data, window.location.origin),
    new Observable((subscriber) => {
      const listener = (event: MessageEvent<unknown>) => {
        const message = event.data;
        if (!isIpcMessage(message)) {
          return;
        }

        subscriber.next(message.payload);
      };
      window.addEventListener("message", listener);

      return () => window.removeEventListener("message", listener);
    }),
    ["BrowserBackground"],
  );

  override async init() {
    await super.init();

    this.manager.register_link(WebIpcService.LinkToExtensionBackground);

    void this.ping();
  }

  async ping() {
    await this.manager.send("BrowserBackground", PingMessagePayload);
    const message = await this.manager.receive("BrowserBackground");

    if (message[0] === PongMessagePayload[0]) {
      // eslint-disable-next-line no-console
      console.log("Connected to extension background");
    }
  }
}

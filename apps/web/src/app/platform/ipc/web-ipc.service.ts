import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { IpcService, PingMessagePayload } from "@bitwarden/common/platform/ipc";
import { Manager, SendError } from "@bitwarden/sdk-internal";

import { WebCommunicationProvider } from "./web-communication-provider";

export class WebIpcService extends IpcService {
  private communicationProvider: WebCommunicationProvider;

  constructor(sdkService: SdkService) {
    super();
  }

  async init() {
    this.communicationProvider = new WebCommunicationProvider();
    this.manager = new Manager(this.communicationProvider);

    await super.init();

    // TODO: remove
    void this.ping();
  }

  async ping() {
    try {
      // eslint-disable-next-line no-console
      console.log("[IPC] Pinging");
      await this.manager.send({
        destination: "BrowserBackground",
        // TODO: Fix hacky hack
        data: PingMessagePayload as any as number[],
        source: undefined,
      });
      // eslint-disable-next-line no-console
      console.log("[IPC] Sent ping");
    } catch (error) {
      if (error instanceof SendError) {
        // eslint-disable-next-line no-console
        return console.error("[IPC] Ping failed", error.debug());
      }

      // eslint-disable-next-line no-console
      console.error("[IPC] Ping failed", error);
    }
  }
}

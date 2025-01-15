import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { IpcService, PingMessagePayload, PongMessagePayload } from "@bitwarden/common/platform/ipc";
import { Destination, Manager } from "@bitwarden/sdk-internal";

import { BackgroundCommunicationProvider } from "./background-communication-provider";

export class IpcBackgroundService extends IpcService {
  private communicationProvider: BackgroundCommunicationProvider;

  constructor(sdkService: SdkService) {
    super();
  }

  async init() {
    this.communicationProvider = new BackgroundCommunicationProvider();
    this.manager = new Manager(this.communicationProvider);

    await super.init();

    this.messages$.subscribe((message) => {
      if (message.data[0] === PingMessagePayload[0] && message.data[1] === PingMessagePayload[1]) {
        void this.pong(message.source);
      }
    });
  }

  async pong(destination: Destination) {
    try {
      // eslint-disable-next-line no-console
      console.log("[IPC] Pinging");
      await this.manager.send({
        destination,
        // TODO: Fix hacky hack
        data: PongMessagePayload as any as number[],
        source: undefined,
      });
      // eslint-disable-next-line no-console
      console.log("[IPC] Sent ping");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[IPC] Ping failed", error);
    }
  }
}

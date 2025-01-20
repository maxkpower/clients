import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { MessageQueue } from "@bitwarden/common/platform/ipc/message-queue";
import { CommunicationProvider, Message } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../browser/browser-api";

export class BackgroundCommunicationProvider implements CommunicationProvider {
  private queue = new MessageQueue<Message>();

  constructor() {
    // Web listener
    BrowserApi.messageListener("platform.ipc", (message, sender) => {
      if (!isIpcMessage(message)) {
        return;
      }
      console.log("BrowserApi.messageListener(platform.ipc) received", message);

      void this.queue.enqueue({ ...message.message, source: { Web: sender.documentId } });
    });

    console.log("BackgroundCommunicationProvider initialized");
  }

  async send(message: Message): Promise<void> {
    if (typeof message.destination === "object") {
      console.log(
        "BackgroundCommunicationProvider.send() sending message to Web",
        message.destination.Web,
      );
      await BrowserApi.tabSendMessage(
        // TODO: We should change Web(String) to Web(Number) in the SDK
        { id: Number(message.destination.Web) } as chrome.tabs.Tab,
        message,
      );
      return;
    }

    throw new Error("Destination not supported.");
  }

  async receive(): Promise<Message> {
    const message = await this.queue.dequeue();
    console.log("BackgroundCommunicationProvider.receive() returning message", message);
    return message;
  }
}

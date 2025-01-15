import { IpcMessage, isIpcMessage } from "@bitwarden/common/platform/ipc";
import { MessageQueue } from "@bitwarden/common/platform/ipc/message-queue";
import { CommunicationProvider, Message } from "@bitwarden/sdk-internal";

export class WebCommunicationProvider implements CommunicationProvider {
  private queue = new MessageQueue<Message>();

  constructor() {
    // Background listener
    window.addEventListener("message", async (event: MessageEvent) => {
      const message = event.data;
      if (!isIpcMessage(message)) {
        return;
      }

      await this.queue.enqueue(message.message);
    });
  }

  async send(message: Message): Promise<void> {
    if (message.destination === "BrowserBackground") {
      window.postMessage(
        { type: "bitwarden-ipc-message", message } satisfies IpcMessage,
        window.location.origin,
      );
    }

    throw new Error("Destination not supported.");
  }

  receive(): Promise<Message> {
    return this.queue.dequeue();
  }
}

import { Observable } from "rxjs";

import { IpcLink, IpcMessage, IpcService } from "@bitwarden/platform";
import { Destination, Manager } from "@bitwarden/sdk-internal";

export class IpcForegroundService extends IpcService {
  private static LinkToBackground = new IpcLink(
    async (data) => {
      await chrome.runtime.sendMessage({ payload: data } as IpcMessage);
    },
    new Observable<Uint8Array>((subscriber) => {
      const listener = (message: IpcMessage) => {
        subscriber.next(message.payload);
      };
      chrome.runtime.onMessage.addListener(listener);

      return () => chrome.runtime.onMessage.removeListener(listener);
    }),
    [Destination.BrowserBackground],
  );

  protected override async registerLinks(manager: Manager): Promise<void> {
    await manager.register_link(IpcForegroundService.LinkToBackground);
  }
}

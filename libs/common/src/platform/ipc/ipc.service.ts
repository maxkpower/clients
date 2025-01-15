import { Observable, shareReplay } from "rxjs";

import { Manager, Message } from "@bitwarden/sdk-internal";

export abstract class IpcService {
  protected manager: Manager;

  messages$: Observable<Message>;

  async init(): Promise<void> {
    this.messages$ = new Observable<Message>((subscriber) => {
      let isSubscribed = true;
      while (isSubscribed) {
        this.manager
          .receive()
          .then((message) => {
            subscriber.next(message);
          })
          .catch((error) => {
            subscriber.error(error);
          });
      }

      return () => {
        isSubscribed = false;
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  async send(message: Message) {
    await this.manager.send(message);
  }
}

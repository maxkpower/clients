import { Injectable, OnDestroy } from "@angular/core";
import { Observable, Subject, switchMap, takeUntil } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Destination } from "@bitwarden/sdk-internal";

import { IpcLink } from "./ipc-link";
import { IpcMessage } from "./ipc-message";

@Injectable()
export class IpcForegroundService implements OnDestroy {
  private destroy$ = new Subject<void>();

  private linkToBackground = new IpcLink(
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

  constructor(private sdkService: SdkService) {}

  init() {
    this.sdkService.client$
      .pipe(
        switchMap(async (client) => {
          const manager = client.ipc().create_manager();
          await manager.register_link(this.linkToBackground);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import { filter, map, Observable } from "rxjs";

import { Duo2faResult, TwoFactorAuthDuoComponentService } from "@bitwarden/auth/angular";

import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";

interface Message {
  command: string;
  code: string;
  state: string;
}

export class ExtensionTwoFactorAuthDuoComponentService implements TwoFactorAuthDuoComponentService {
  constructor(private browserMessagingApi: ZonedMessageListenerService) {}
  listenForDuo2faResult$(): Observable<Duo2faResult> {
    return this.browserMessagingApi.messageListener$().pipe(
      filter((msg: Message) => msg.command === "duoResult"),
      map((msg: Message) => {
        return {
          code: msg.code,
          state: msg.state,
          token: `${msg.code}|${msg.state}`,
        } as Duo2faResult;
      }),
    );
  }
}

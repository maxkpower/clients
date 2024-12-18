import { map, Observable } from "rxjs";

import { TwoFactorAuthDuoComponentService, Duo2faResult } from "@bitwarden/auth/angular";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";

// TODO: PM-16209 We should create a Duo2faMessageListenerService that listens for messages from duo
// and this command definition should move to that file.
// We should explore consolidating the messaging approach across clients - i.e., we
// should use the same command definition across all clients. We use duoResult on extension for no real
// benefit.
export const DUO_2FA_RESULT_COMMAND = new CommandDefinition<{ code: string; state: string }>(
  "duoCallback",
);

export class DesktopTwoFactorAuthDuoComponentService implements TwoFactorAuthDuoComponentService {
  constructor(private messageListener: MessageListener) {}
  listenForDuo2faResult$(): Observable<Duo2faResult> {
    return this.messageListener.messages$(DUO_2FA_RESULT_COMMAND).pipe(
      map((msg) => {
        return {
          code: msg.code,
          state: msg.state,
          token: `${msg.code}|${msg.state}`,
        } as Duo2faResult;
      }),
    );
  }
}

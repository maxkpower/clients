import {
  DefaultTwoFactorAuthComponentService,
  TwoFactorAuthComponentService,
} from "@bitwarden/auth/angular";

import { BrowserApi } from "../../platform/browser/browser-api";
import { closeTwoFactorAuthPopout } from "../popup/utils/auth-popout-window";

export class ExtensionTwoFactorAuthComponentService
  extends DefaultTwoFactorAuthComponentService
  implements TwoFactorAuthComponentService
{
  shouldCheckForWebauthnResponseOnInit(): boolean {
    return true;
  }

  async handleSso2faFlowSuccess(): Promise<void> {
    // Force sidebars (FF && Opera) to reload while exempting current window
    // because we are just going to close the current window.
    BrowserApi.reloadOpenWindows(true);

    // We don't need this window anymore because the intent is for the user to be left
    // on the web vault screen which tells them to continue in the browser extension (sidebar or popup)
    await closeTwoFactorAuthPopout();
  }
}

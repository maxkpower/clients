import {
  DefaultTwoFactorAuthComponentService,
  TwoFactorAuthComponentService,
} from "@bitwarden/auth/angular";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { DialogService } from "@bitwarden/components";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";
import { closeTwoFactorAuthPopout } from "../popup/utils/auth-popout-window";

export class ExtensionTwoFactorAuthComponentService
  extends DefaultTwoFactorAuthComponentService
  implements TwoFactorAuthComponentService
{
  constructor(
    private dialogService: DialogService,
    private window: Window,
  ) {
    super();
  }

  shouldCheckForWebauthnResponseOnInit(): boolean {
    return true;
  }

  async extendPopupWidthIfRequired(selected2faProviderType: TwoFactorProviderType): Promise<void> {
    // WebAuthn prompt appears inside the popup on linux, and requires a larger popup width
    // than usual to avoid cutting off the dialog.
    const isLinux = await this.isLinux();
    if (selected2faProviderType === TwoFactorProviderType.WebAuthn && isLinux) {
      document.body.classList.add("linux-webauthn");
    }
  }

  removePopupWidthExtension(): void {
    document.body.classList.remove("linux-webauthn");
  }

  async openPopoutIfApprovedForEmail2fa(
    selected2faProviderType: TwoFactorProviderType,
  ): Promise<void> {
    if (
      selected2faProviderType === TwoFactorProviderType.Email &&
      BrowserPopupUtils.inPopup(this.window)
    ) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });
      if (confirmed) {
        await BrowserPopupUtils.openCurrentPagePopout(this.window);
      }
    }
  }

  closeWindow(): void {
    this.window.close();
  }

  async handleSso2faFlowSuccess(): Promise<void> {
    // Force sidebars (FF && Opera) to reload while exempting current window
    // because we are just going to close the current window.
    BrowserApi.reloadOpenWindows(true);

    // We don't need this window anymore because the intent is for the user to be left
    // on the web vault screen which tells them to continue in the browser extension (sidebar or popup)
    await closeTwoFactorAuthPopout();
  }

  private async isLinux(): Promise<boolean> {
    const platformInfo = await BrowserApi.getPlatformInfo();
    return platformInfo.os === "linux";
  }
}

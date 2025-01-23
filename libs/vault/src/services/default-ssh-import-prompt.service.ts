import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SshKeyPasswordPromptComponent } from "@bitwarden/importer/ui";
import { import_ssh_key, SshKey, SshKeyImportError } from "@bitwarden/sdk-internal";

/**
 * Used to import ssh keys and prompt for their password.
 */
export class DefaultSshImportPromptService {
  constructor(
    private dialogService: DialogService,
    private sdkService: SdkService,
    private toastService: ToastService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  private async importUsingSdk(key: string, password: string): Promise<SshKey> {
    await firstValueFrom(this.sdkService.client$);
    return import_ssh_key(key, password);
  }

  async importSshKeyFromClipboard(): Promise<SshKey | null> {
    const key = await this.platformUtilsService.readFromClipboard();

    let isPasswordProtectedSshKey = false;

    let parsedKey: SshKey | null = null;

    try {
      parsedKey = await this.importUsingSdk(key, "");
    } catch (e) {
      const error = e as SshKeyImportError;
      if (error.variant === "PasswordRequired" || error.variant === "WrongPassword") {
        isPasswordProtectedSshKey = true;
      } else {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t(this.sshImportErrorVariantToI18nKey(error.variant)),
        });
        return null;
      }
    }

    if (isPasswordProtectedSshKey) {
      for (;;) {
        const password = await this.getSshKeyPassword();
        if (password === "" || password == null) {
          return null;
        }

        try {
          parsedKey = await this.importUsingSdk(key, password);
          break;
        } catch (e) {
          const error = e as SshKeyImportError;
          if (error.variant !== "WrongPassword") {
            this.toastService.showToast({
              variant: "error",
              title: "",
              message: this.i18nService.t(this.sshImportErrorVariantToI18nKey(error.variant)),
            });
            return null;
          }
        }
      }
    }

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("sshKeyImported"),
    });

    return parsedKey;
  }

  private sshImportErrorVariantToI18nKey(variant: string): string {
    switch (variant) {
      case "ParsingError":
        return "invalidSshKey";
      case "UnsupportedKeyType":
        return "sshKeyTypeUnsupported";
      case "PasswordRequired":
      case "WrongPassword":
        return "sshKeyWrongPassword";
      default:
        return "errorOccurred";
    }
  }

  private async getSshKeyPassword(): Promise<string | undefined> {
    const dialog = this.dialogService.open<string>(SshKeyPasswordPromptComponent, {
      ariaModal: true,
    });

    return await firstValueFrom(dialog.closed);
  }
}

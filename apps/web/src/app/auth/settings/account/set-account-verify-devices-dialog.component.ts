import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SetVerifyDevicesRequest } from "@bitwarden/common/auth/models/request/set-verify-devices.request";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

@Component({
  templateUrl: "./set-account-verify-devices-dialog.component.html",
})
export class SetAccountVerifyDevicesDialogComponent {
  setVerifyDevicesForm = this.formBuilder.group({
    verification: undefined as Verification | undefined,
  });
  invalidSecret: boolean = false;
  verifyNewDeviceLogin: boolean = true;
  dialogDesc: string = ""; // on or off
  dialogSubmitButtonDesc: string = ""; // on or off
  dialogBodyDesc: string = ""; // turn on or off

  constructor(
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private accountApiService: AccountApiService,
    private accountService: AccountService,
    private dialogRef: DialogRef,
    private toastService: ToastService,
  ) {
    //todo set dialog text based on account information
    this.verifyNewDeviceLogin = getVerifyDevices;
    this.accountService.activeAccount$.pipe(
      (a) => (this.verifyNewDeviceLogin = a?.verifyDevices ?? true),
    );
    this.dialogDesc = this.i18nService.t("accountNewDeviceLoginProtection");
    this.dialogSubmitButtonDesc = this.i18nService.t("accountNewDeviceLoginProtectionSave");
    this.dialogBodyDesc = this.i18nService.t("accountNewDeviceLoginProtectionDesc");
  }

  submit = async () => {
    try {
      // const verification = this.setVerifyDevicesForm.get("verification").value;
      //todo create request object
      const request: SetVerifyDevicesRequest = null;
      await this.accountApiService.setVerifyDevices(request);
      this.dialogRef.close();
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("accountNewDeviceLoginProtectionSaved"),
        message: this.i18nService.t("accountNewDeviceLoginProtectionSavedDesc"),
      });
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 400) {
        this.invalidSecret = true;
      }
      throw e;
    }
  };

  static open(dialogService: DialogService) {
    return dialogService.open(SetAccountVerifyDevicesDialogComponent);
  }
}

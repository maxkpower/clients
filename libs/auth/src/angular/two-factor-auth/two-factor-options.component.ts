import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnInit, Output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

export enum TwoFactorOptionsDialogResult {
  Provider = "Provider selected",
  Recover = "Recover selected",
}

export type TwoFactorOptionsDialogResultType = {
  result: TwoFactorOptionsDialogResult;
  type: TwoFactorProviderType;
};

@Component({
  standalone: true,
  selector: "app-two-factor-options",
  templateUrl: "two-factor-options.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
  providers: [],
})
export class TwoFactorOptionsComponent implements OnInit {
  @Output() onProviderSelected = new EventEmitter<TwoFactorProviderType>();
  @Output() onRecoverSelected = new EventEmitter();

  providers: any[] = [];

  // todo: remove after porting to two-factor-options-v2
  // icons cause the layout to break on browser extensions
  areIconsDisabled = false;

  constructor(
    private twoFactorService: TwoFactorService,
    private environmentService: EnvironmentService,
    private dialogRef: DialogRef,
    private platformUtilsService: PlatformUtilsService,
  ) {
    // todo: remove after porting to two-factor-options-v2
    if (this.platformUtilsService.getClientType() == ClientType.Browser) {
      this.areIconsDisabled = true;
    }
  }

  async ngOnInit() {
    this.providers = await this.twoFactorService.getSupportedProviders(window);
  }

  async choose(p: any) {
    this.onProviderSelected.emit(p.type);
    this.dialogRef.close({ result: TwoFactorOptionsDialogResult.Provider, type: p.type });
  }

  static open(dialogService: DialogService) {
    return dialogService.open<TwoFactorOptionsDialogResultType>(TwoFactorOptionsComponent);
  }
}

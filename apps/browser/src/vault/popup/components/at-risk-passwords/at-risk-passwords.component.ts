import { Component } from "@angular/core";

import { ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "vault-at-risk-passwords",
  standalone: true,
  imports: [PopupPageComponent, PopupHeaderComponent, I18nPipe, PopOutComponent, ItemModule],
  templateUrl: "./at-risk-passwords.component.html",
})
export class AtRiskPasswordsComponent {}

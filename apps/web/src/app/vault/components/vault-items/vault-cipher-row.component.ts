import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { MenuTriggerForDirective } from "@bitwarden/components";

import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
})
export class VaultCipherRowComponent implements OnInit {
  protected RowHeightClass = RowHeightClass;

  /**
   * Flag to determine if the extension refresh feature flag is enabled.
   */
  protected extensionRefreshEnabled = false;

  @ViewChild(MenuTriggerForDirective, { static: false }) menuTrigger: MenuTriggerForDirective;

  @Input() disabled: boolean;
  @Input() cipher: CipherView;
  @Input() showOwner: boolean;
  @Input() showCollections: boolean;
  @Input() showGroups: boolean;
  @Input() showPremiumFeatures: boolean;
  @Input() useEvents: boolean;
  @Input() cloneable: boolean;
  @Input() organizations: Organization[];
  @Input() collections: CollectionView[];
  @Input() viewingOrgVault: boolean;
  @Input() canEditCipher: boolean;

  @Output() onEvent = new EventEmitter<VaultItemEvent>();

  @Input() checked: boolean;
  @Output() checkedToggled = new EventEmitter<void>();

  protected CipherType = CipherType;

  constructor(private configService: ConfigService) {}

  /**
   * Lifecycle hook for component initialization.
   * Checks if the extension refresh feature flag is enabled to provide to template.
   */
  async ngOnInit(): Promise<void> {
    this.extensionRefreshEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.ExtensionRefresh),
    );
  }

  protected get showTotpCopyButton() {
    return (
      (this.cipher.login?.hasTotp ?? false) &&
      (this.cipher.organizationUseTotp || this.showPremiumFeatures)
    );
  }

  protected get showFixOldAttachments() {
    return this.cipher.hasOldAttachments && this.cipher.organizationId == null;
  }

  protected get showAttachments() {
    return this.canEditCipher || this.cipher.attachments?.length > 0;
  }

  protected get showAssignToCollections() {
    return this.canEditCipher && !this.cipher.isDeleted;
  }

  protected get showClone() {
    return this.cloneable && !this.cipher.isDeleted;
  }

  protected get showEventLogs() {
    return this.useEvents && this.cipher.organizationId;
  }

  protected get isLoginCipher() {
    return this.cipher.type === this.CipherType.Login && !this.cipher.isDeleted;
  }

  protected get hasVisibleLoginOptions() {
    return (
      this.isLoginCipher &&
      (!!this.cipher.login?.username ||
        (this.cipher.viewPassword && !!this.cipher.login?.password) ||
        this.showTotpCopyButton ||
        this.cipher.login.canLaunch)
    );
  }

  protected get isCardCipher(): boolean {
    return this.cipher.type === this.CipherType.Card && !this.cipher.isDeleted;
  }

  protected get hasVisibleCardOptions(): boolean {
    return this.isCardCipher && (!!this.cipher.card.number || !!this.cipher.card.code);
  }

  protected get isIdentityCipher() {
    return this.cipher.type === this.CipherType.Identity && !this.cipher.isDeleted;
  }

  protected get hasVisibleIdentityOptions(): boolean {
    return (
      this.isIdentityCipher &&
      (!!this.cipher.identity.fullAddressForCopy ||
        !!this.cipher.identity.email ||
        !!this.cipher.identity.username ||
        !!this.cipher.identity.phone)
    );
  }

  protected get isSecureNoteCipher() {
    return this.cipher.type === this.CipherType.SecureNote && !this.cipher.isDeleted;
  }

  protected get hasVisibleSecureNoteOptions(): boolean {
    return this.isIdentityCipher && !!this.cipher.notes;
  }

  protected get showMenuDivider() {
    return (
      this.hasVisibleLoginOptions ||
      this.hasVisibleCardOptions ||
      this.hasVisibleIdentityOptions ||
      this.hasVisibleSecureNoteOptions
    );
  }

  protected clone() {
    this.onEvent.emit({ type: "clone", item: this.cipher });
  }

  protected events() {
    this.onEvent.emit({ type: "viewEvents", item: this.cipher });
  }

  protected restore() {
    this.onEvent.emit({ type: "restore", items: [this.cipher] });
  }

  protected deleteCipher() {
    this.onEvent.emit({ type: "delete", items: [{ cipher: this.cipher }] });
  }

  protected attachments() {
    this.onEvent.emit({ type: "viewAttachments", item: this.cipher });
  }

  protected assignToCollections() {
    this.onEvent.emit({ type: "assignToCollections", items: [this.cipher] });
  }

  protected toggleFavorite() {
    this.cipher.favorite = !this.cipher.favorite;
    this.onEvent.emit({
      type: "toggleFavorite",
      item: this.cipher,
    });
  }

  protected editCipher() {
    this.onEvent.emit({ type: "editCipher", item: this.cipher });
  }

  @HostListener("contextmenu", ["$event"])
  protected onRightClick(event: MouseEvent) {
    if (!this.disabled) {
      this.menuTrigger.toggleMenuOnRightClick(event);
    }
  }
}

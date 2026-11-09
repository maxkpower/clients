import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  CalloutModule,
  TypographyModule,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { shortenFingerprint } from "../utils/shorten-fingerprint";

export interface CreateMachineAccountRequestParams {
  requesterName?: string;
  requesterFingerprint?: string;
  /** The agent's proposed name — only a hint: the user sees and can edit it before approving. */
  machineAccountName: string;
  /** SM-enabled organizations to create in. Never empty — the caller denies before opening this
   *  dialog when there are none. */
  organizations: Organization[];
  lastOrganizationId?: string;
  userId: UserId;
}

export interface CreateMachineAccountRequestResult {
  approved: boolean;
  /** The organization the new machine account was approved into. */
  organizationId?: string;
  /** The final, user-confirmed name (the agent's proposal, possibly edited). */
  name?: string;
}

/**
 * Approval dialog for a `machineAccountCreate` request. Sibling of
 * `CreateProjectRequestComponent`: an organization picker, plus an editable name prefilled with
 * the agent's proposal (agent-provided names are only hints; the user always has the last word).
 */
@Component({
  selector: "app-create-machine-account-request",
  templateUrl: "create-machine-account-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    CalloutModule,
    TypographyModule,
    FormFieldModule,
    SelectModule,
  ],
})
export class CreateMachineAccountRequestComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<CreateMachineAccountRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  protected readonly params = inject<CreateMachineAccountRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  private readonly initialOrganizationId = (
    (this.params.lastOrganizationId != null &&
    this.params.organizations.some((org) => org.id === this.params.lastOrganizationId)
      ? this.params.lastOrganizationId
      : undefined) ??
    (this.params.organizations.length === 1 ? this.params.organizations[0].id : undefined)
  )?.toString();

  protected readonly createMachineAccountRequestForm = this.formBuilder.group({
    organizationId: [this.initialOrganizationId ?? null, [Validators.required]],
    name: [this.params.machineAccountName, [Validators.required]],
  });

  static open(dialogService: DialogService, params: CreateMachineAccountRequestParams) {
    return dialogService.open<CreateMachineAccountRequestResult, CreateMachineAccountRequestParams>(
      CreateMachineAccountRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    const name = this.createMachineAccountRequestForm.value.name?.trim();
    if (this.createMachineAccountRequestForm.invalid || !name) {
      this.createMachineAccountRequestForm.markAllAsTouched();
      return;
    }

    await this.dialogRef.close({
      approved: true,
      organizationId: this.createMachineAccountRequestForm.value.organizationId ?? undefined,
      name,
    });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}

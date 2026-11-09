import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { from, map, of, startWith, switchMap } from "rxjs";

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
  IconComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AgentAccessAccessTokensService,
  SmMachineAccountMatch,
} from "../services/agent-access-access-tokens.service";
import {
  AgentAccessSecretsService,
  SmProjectMatch,
} from "../services/agent-access-secrets.service";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

/** Selected in the project `bit-select` to reveal the "new project name" input. Same sentinel
 *  pattern as `CreateSecretRequestComponent`. */
const NEW_PROJECT_SENTINEL = "__agent-access-new-project__";

/** Lifetimes offered in the expiry picker, in days; the agent's hint is added when it is not one
 *  of them. "Never" is a separate `null` option. */
const EXPIRY_DAY_OPTIONS = [7, 30, 60, 90, 365];

/** Preselected lifetime when the agent expressed no preference. A finite default, not "never":
 *  the user can still pick "never", but an unprompted choice should not be the weakest one. */
const DEFAULT_EXPIRY_DAYS = 30;

export interface CreateAccessTokenRequestParams {
  /** Same fallback chain as `CreateSecretRequestComponent.requesterDisplayName`. */
  requesterName?: string;
  requesterFingerprint?: string;
  /** The agent's machine-account hint: an id, or a name. Only ever used to PRESELECT an account
   *  whose id or exact decrypted name matches; the user always sees and can change it. */
  machineAccountHint: string;
  /** The agent's proposed token name. Editable. */
  tokenName: string;
  /** The agent's proposed lifetime in days. Editable. Absent = no preference. */
  expiresInDays?: number;
  /** The agent's proposed name for the secret that will hold the token. Editable. */
  secretName: string;
  /** Destination-project name HINT; only preselects a writable project with that exact name. */
  projectHint?: string;
  /** SM-enabled organizations. Never empty — the caller denies before opening the dialog. */
  organizations: Organization[];
  userId: UserId;
  /** Session-remembered last choices (in memory only), as for secret creation. */
  lastOrganizationId?: string;
  lastProjectId?: string;
}

export interface CreateAccessTokenRequestResult {
  approved: boolean;
  organizationId?: string;
  machineAccountId?: string;
  tokenName?: string;
  /** `null` = the token never expires. */
  expiresInDays?: number | null;
  secretName?: string;
  /** Set when an existing project was chosen. Mutually exclusive with `newProjectName`. */
  projectId?: string;
  /** Set when the user typed a name for a brand-new project. */
  newProjectName?: string;
}

/**
 * Approval dialog for an `accessTokenCreate` request. Every value the agent proposed is a hint
 * the user can change: machine account, token name, lifetime, destination organization, project
 * and secret name. There is deliberately no token field here at all — the token does not exist
 * until the user authorizes, and is then written straight into the destination secret by
 * `AgentAccessAccessTokensService` without ever being displayed, returned or sent to the agent.
 */
@Component({
  selector: "app-create-access-token-request",
  templateUrl: "create-access-token-request.component.html",
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
    IconComponent,
  ],
})
export class CreateAccessTokenRequestComponent {
  protected readonly NEW_PROJECT_SENTINEL = NEW_PROJECT_SENTINEL;

  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<CreateAccessTokenRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly agentAccessSecretsService = inject(AgentAccessSecretsService);
  private readonly agentAccessAccessTokensService = inject(AgentAccessAccessTokensService);
  protected readonly params = inject<CreateAccessTokenRequestParams>(DIALOG_DATA);

  protected readonly requesterDisplayName =
    this.params.requesterName?.trim() ||
    (this.params.requesterFingerprint
      ? shortenFingerprint(this.params.requesterFingerprint)
      : this.i18nService.t("agentAccessUnknownApplication"));

  /** Day counts offered in the expiry picker, with the agent's hint included. */
  protected readonly expiryDayOptions = [
    ...new Set([
      ...EXPIRY_DAY_OPTIONS,
      ...(this.params.expiresInDays ? [this.params.expiresInDays] : []),
    ]),
  ].sort((a, b) => a - b);

  private readonly initialOrganizationId = (
    (this.params.lastOrganizationId != null &&
    this.params.organizations.some((org) => org.id === this.params.lastOrganizationId)
      ? this.params.lastOrganizationId
      : undefined) ??
    (this.params.organizations.length === 1 ? this.params.organizations[0].id : undefined)
  )?.toString();

  protected readonly createAccessTokenRequestForm = this.formBuilder.group({
    organizationId: [this.initialOrganizationId ?? null, Validators.required],
    machineAccountId: [null as string | null, Validators.required],
    tokenName: [this.params.tokenName, [Validators.required, Validators.maxLength(80)]],
    expiresInDays: [(this.params.expiresInDays ?? DEFAULT_EXPIRY_DAYS) as number | null],
    secretName: [this.params.secretName, Validators.required],
    projectId: [null as string | null],
    newProjectName: [""],
  });

  private readonly organizationId = toSignal(
    this.createAccessTokenRequestForm.controls.organizationId.valueChanges,
    { initialValue: this.createAccessTokenRequestForm.controls.organizationId.value },
  );

  protected readonly selectedOrganization = computed(() =>
    this.params.organizations.find((org) => org.id === this.organizationId()),
  );

  /** An admin's project-less secret is admin-visible only; the dialog warns, as for secrets. */
  protected readonly isAdminRelaxed = computed(() => this.selectedOrganization()?.isAdmin === true);

  private readonly projectIdValue = toSignal(
    this.createAccessTokenRequestForm.controls.projectId.valueChanges,
    { initialValue: this.createAccessTokenRequestForm.controls.projectId.value },
  );

  protected readonly creatingNewProject = computed(
    () => this.projectIdValue() === NEW_PROJECT_SENTINEL,
  );

  protected readonly noProjectSelected = computed(
    () => !this.creatingNewProject() && !this.projectIdValue(),
  );

  /** Machine accounts of the selected organization; reloads when the organization changes. */
  protected readonly machineAccounts = toSignal(
    this.createAccessTokenRequestForm.controls.organizationId.valueChanges.pipe(
      startWith(this.createAccessTokenRequestForm.controls.organizationId.value),
      switchMap((organizationId) =>
        organizationId
          ? from(
              this.agentAccessAccessTokensService.listMachineAccounts(
                organizationId,
                this.params.userId,
              ),
            )
          : of<SmMachineAccountMatch[]>([]),
      ),
    ),
    { initialValue: [] as SmMachineAccountMatch[] },
  );

  /** Writable projects of the selected organization (a legal secret-creation target). */
  protected readonly projects = toSignal(
    this.createAccessTokenRequestForm.controls.organizationId.valueChanges.pipe(
      startWith(this.createAccessTokenRequestForm.controls.organizationId.value),
      switchMap((organizationId) =>
        organizationId
          ? from(
              this.agentAccessSecretsService.listProjects(organizationId, this.params.userId),
            ).pipe(map((all) => all.filter((project) => project.write)))
          : of<SmProjectMatch[]>([]),
      ),
    ),
    { initialValue: [] as SmProjectMatch[] },
  );

  constructor() {
    // Preselect once per list, never over a user choice: the machine account whose id equals the
    // hint, else whose decrypted name equals it exactly.
    let machineAccountHintApplied = false;
    effect(() => {
      const accounts = this.machineAccounts();
      if (machineAccountHintApplied || accounts.length === 0) {
        return;
      }
      machineAccountHintApplied = true;
      const hint = this.params.machineAccountHint;
      const match =
        accounts.find((account) => account.id === hint) ??
        accounts.find((account) => account.name === hint);
      if (match != null) {
        this.createAccessTokenRequestForm.controls.machineAccountId.setValue(match.id);
      }
    });

    // Same project preselection rules as `CreateSecretRequestComponent`.
    let projectHintApplied = false;
    effect(() => {
      const projects = this.projects();
      if (projectHintApplied || projects.length === 0) {
        return;
      }
      projectHintApplied = true;
      const remembered = this.params.lastProjectId
        ? projects.find((project) => project.id === this.params.lastProjectId)
        : undefined;
      const hinted = this.params.projectHint
        ? projects.find((project) => project.name === this.params.projectHint)
        : undefined;
      const preselected = remembered ?? hinted;
      if (preselected != null) {
        this.createAccessTokenRequestForm.controls.projectId.setValue(preselected.id);
      }
    });
  }

  static open(dialogService: DialogService, params: CreateAccessTokenRequestParams) {
    return dialogService.open<CreateAccessTokenRequestResult, CreateAccessTokenRequestParams>(
      CreateAccessTokenRequestComponent,
      { data: params },
    );
  }

  readonly submit = async () => {
    if (this.createAccessTokenRequestForm.invalid) {
      this.createAccessTokenRequestForm.markAllAsTouched();
      return;
    }
    if (this.noProjectSelected() && !this.isAdminRelaxed()) {
      this.createAccessTokenRequestForm.markAllAsTouched();
      return;
    }

    const value = this.createAccessTokenRequestForm.value;
    const tokenName = value.tokenName?.trim();
    const secretName = value.secretName?.trim();
    if (!tokenName || !secretName) {
      this.createAccessTokenRequestForm.markAllAsTouched();
      return;
    }
    const common = {
      approved: true,
      organizationId: value.organizationId ?? undefined,
      machineAccountId: value.machineAccountId ?? undefined,
      tokenName,
      expiresInDays: value.expiresInDays ?? null,
      secretName,
    };

    if (value.projectId === NEW_PROJECT_SENTINEL) {
      const newProjectName = value.newProjectName?.trim();
      if (!newProjectName) {
        this.createAccessTokenRequestForm.markAllAsTouched();
        return;
      }
      await this.dialogRef.close({ ...common, newProjectName });
      return;
    }
    await this.dialogRef.close({ ...common, projectId: value.projectId || undefined });
  };

  readonly deny = async () => {
    await this.dialogRef.close({ approved: false });
  };
}

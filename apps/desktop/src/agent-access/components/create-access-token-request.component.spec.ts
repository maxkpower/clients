import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AgentAccessAccessTokensService } from "../services/agent-access-access-tokens.service";
import {
  AgentAccessSecretsService,
  SmProjectMatch,
} from "../services/agent-access-secrets.service";

import {
  CreateAccessTokenRequestComponent,
  CreateAccessTokenRequestParams,
  CreateAccessTokenRequestResult,
} from "./create-access-token-request.component";

// `AgentAccessSecretsService`'s module imports the generator barrel; only the module must exist.
jest.mock("@bitwarden/generator-legacy", () => ({
  PasswordGenerationServiceAbstraction: class {},
}));

const UserOne = "user-1" as UserId;

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return { id: "org-1", name: "Acme Inc", isAdmin: false, ...overrides } as unknown as Organization;
}

function makeParams(
  overrides: Partial<CreateAccessTokenRequestParams> = {},
): CreateAccessTokenRequestParams {
  return {
    requesterFingerprint: "abcdef123456",
    machineAccountHint: "ci-bot",
    tokenName: "ci-token",
    expiresInDays: 30,
    secretName: "CI_BOT_TOKEN",
    organizations: [makeOrg()],
    userId: UserOne,
    ...overrides,
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("CreateAccessTokenRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<CreateAccessTokenRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;
  let mockListProjects: jest.Mock;
  let mockListMachineAccounts: jest.Mock;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<CreateAccessTokenRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
    mockListProjects = jest
      .fn()
      .mockResolvedValue([{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch]);
    mockListMachineAccounts = jest.fn().mockResolvedValue([
      { id: "ma-1", name: "ci-bot" },
      { id: "ma-2", name: "other-bot" },
    ]);
  });

  function createComponent(params: CreateAccessTokenRequestParams) {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
        { provide: AgentAccessSecretsService, useValue: { listProjects: mockListProjects } },
        {
          provide: AgentAccessAccessTokensService,
          useValue: { listMachineAccounts: mockListMachineAccounts },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new CreateAccessTokenRequestComponent());
  }

  const form = (c: CreateAccessTokenRequestComponent) => c["createAccessTokenRequestForm"];

  it("prefills the agent's hints but lets the user change every one of them", async () => {
    const component = createComponent(makeParams());
    await flush();

    expect(form(component).value).toEqual(
      expect.objectContaining({
        organizationId: "org-1",
        tokenName: "ci-token",
        expiresInDays: 30,
        secretName: "CI_BOT_TOKEN",
      }),
    );
    expect(Object.keys(form(component).controls)).toEqual(
      expect.arrayContaining([
        "organizationId",
        "machineAccountId",
        "tokenName",
        "expiresInDays",
        "secretName",
        "projectId",
      ]),
    );
  });

  describe("machine account preselection", () => {
    it("preselects the account whose exact name equals the hint", async () => {
      const component = createComponent(makeParams({ machineAccountHint: "ci-bot" }));
      await flush();

      expect(form(component).value.machineAccountId).toBe("ma-1");
    });

    it("preselects the account whose id equals the hint", async () => {
      const component = createComponent(makeParams({ machineAccountHint: "ma-2" }));
      await flush();

      expect(form(component).value.machineAccountId).toBe("ma-2");
    });

    it("selects nothing, and blocks submit, when the hint matches no account", async () => {
      const component = createComponent(makeParams({ machineAccountHint: "nope" }));
      await flush();
      form(component).patchValue({ projectId: "proj-1" });

      expect(form(component).value.machineAccountId).toBeNull();
      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("reloads the account list when the organization changes", async () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })] }),
      );
      await flush();
      mockListMachineAccounts.mockClear();

      form(component).patchValue({ organizationId: "org-2" });
      await flush();

      expect(mockListMachineAccounts).toHaveBeenCalledWith("org-2", UserOne);
    });
  });

  describe("expiry options", () => {
    it("includes the agent's non-standard lifetime as an option", () => {
      const component = createComponent(makeParams({ expiresInDays: 45 }));

      expect(component["expiryDayOptions"]).toContain(45);
      expect(form(component).value.expiresInDays).toBe(45);
    });

    it("defaults to a finite lifetime when the agent expressed no preference", () => {
      const component = createComponent(makeParams({ expiresInDays: undefined }));

      expect(form(component).value.expiresInDays).toBe(30);
    });
  });

  describe("submit", () => {
    it("returns the user's final choices, not the agent's hints", async () => {
      const component = createComponent(makeParams());
      await flush();
      form(component).patchValue({
        machineAccountId: "ma-2",
        tokenName: "  renamed  ",
        expiresInDays: 7,
        secretName: "OTHER_NAME",
        projectId: "proj-1",
      });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        approved: true,
        organizationId: "org-1",
        machineAccountId: "ma-2",
        tokenName: "renamed",
        expiresInDays: 7,
        secretName: "OTHER_NAME",
        projectId: "proj-1",
      });
    });

    it("returns expiresInDays: null for 'never'", async () => {
      const component = createComponent(makeParams());
      await flush();
      form(component).patchValue({ expiresInDays: null, projectId: "proj-1" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ expiresInDays: null }),
      );
    });

    it("blocks submit with no project for a non-admin organization", async () => {
      const component = createComponent(makeParams());
      await flush();

      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("allows no project for an admin organization", async () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1", isAdmin: true })] }),
      );
      await flush();

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ approved: true, projectId: undefined }),
      );
    });

    it("returns a trimmed newProjectName when creating a new project", async () => {
      const component = createComponent(makeParams());
      await flush();
      form(component).patchValue({
        projectId: "__agent-access-new-project__",
        newProjectName: " t ",
      });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ newProjectName: "t" }),
      );
    });

    it("rejects an empty token name", async () => {
      const component = createComponent(makeParams());
      await flush();
      form(component).patchValue({ tokenName: "", projectId: "proj-1" });

      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  it("deny closes with approved: false and nothing else", async () => {
    const component = createComponent(makeParams());

    await component.deny();

    expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
  });
});

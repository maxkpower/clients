import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  CreateMachineAccountRequestComponent,
  CreateMachineAccountRequestParams,
  CreateMachineAccountRequestResult,
} from "./create-machine-account-request.component";

const UserOne = "user-1" as UserId;

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return { id: "org-1", name: "Acme Inc", ...overrides } as unknown as Organization;
}

function makeParams(
  overrides: Partial<CreateMachineAccountRequestParams> = {},
): CreateMachineAccountRequestParams {
  return {
    machineAccountName: "ci-runner",
    organizations: [makeOrg()],
    userId: UserOne,
    ...overrides,
  };
}

describe("CreateMachineAccountRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<CreateMachineAccountRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<CreateMachineAccountRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(
    params: CreateMachineAccountRequestParams,
  ): CreateMachineAccountRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new CreateMachineAccountRequestComponent());
  }

  it("prefills the name field with the agent's proposed name", () => {
    const component = createComponent(makeParams({ machineAccountName: "ci-runner" }));

    expect(component["createMachineAccountRequestForm"].value.name).toBe("ci-runner");
  });

  it("auto-selects the only organization", () => {
    const component = createComponent(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));

    expect(component["createMachineAccountRequestForm"].value.organizationId).toBe("org-1");
  });

  it("blocks submit when no organization is selected", async () => {
    const component = createComponent(
      makeParams({ organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })] }),
    );

    await component.submit();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it("preselects the session-remembered last organization when valid", () => {
    const component = createComponent(
      makeParams({
        organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })],
        lastOrganizationId: "org-2",
      }),
    );

    expect(component["createMachineAccountRequestForm"].value.organizationId).toBe("org-2");
  });

  it("ignores a remembered organization that is no longer available", () => {
    const component = createComponent(
      makeParams({
        organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })],
        lastOrganizationId: "org-gone",
      }),
    );

    expect(component["createMachineAccountRequestForm"].value.organizationId).toBeNull();
  });

  it("approves with the selected organization and the proposed name", async () => {
    const component = createComponent(makeParams());

    await component.submit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      approved: true,
      organizationId: "org-1",
      name: "ci-runner",
    });
  });

  it("approves with the user-edited name, trimmed", async () => {
    const component = createComponent(makeParams());
    component["createMachineAccountRequestForm"].controls.name.setValue("  prod-deployer ");

    await component.submit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      approved: true,
      organizationId: "org-1",
      name: "prod-deployer",
    });
  });

  it("blocks submit when the name is cleared or blank", async () => {
    const component = createComponent(makeParams());
    component["createMachineAccountRequestForm"].controls.name.setValue("   ");

    await component.submit();

    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it("denies without an organization or name", async () => {
    const component = createComponent(makeParams());

    await component.deny();

    expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
  });

  it("labels the requester by its trimmed name", () => {
    expect(createComponent(makeParams({ requesterName: " aac " }))["requesterDisplayName"]).toBe(
      "aac",
    );
  });
});

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_ONBOARDING,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { VaultOnboardingService as VaultOnboardingServiceAbstraction } from "./abstraction/vault-onboarding.service";

export type VaultOnboardingTasks = {
  createAccount: boolean;
  importData: boolean;
  installExtension: boolean;
};

const VAULT_ONBOARDING_KEY = new UserKeyDefinition<VaultOnboardingTasks>(
  VAULT_ONBOARDING,
  "tasks",
  {
    deserializer: (jsonData) => jsonData,
    clearOn: [], // do not clear tutorials
  },
);

@Injectable()
export class VaultOnboardingService implements VaultOnboardingServiceAbstraction {
  private vaultOnboardingState?: SingleUserState<VaultOnboardingTasks>;

  constructor(private stateProvider: StateProvider) {}

  vaultOnboardingState$(userId: UserId): Observable<VaultOnboardingTasks> {
    this.vaultOnboardingState = this.stateProvider.getUser(userId, VAULT_ONBOARDING_KEY);
    return this.vaultOnboardingState.state$;
  }
  async setVaultOnboardingTasks(newState: VaultOnboardingTasks): Promise<void> {
    await this.vaultOnboardingState.update(() => {
      return { ...newState };
    });
  }
}

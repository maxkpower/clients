import { Injectable, OnDestroy } from "@angular/core";
import { Observable, Subject, takeUntil } from "rxjs";

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
export class VaultOnboardingService implements VaultOnboardingServiceAbstraction, OnDestroy {
  private destroy$ = new Subject<void>();
  private vaultOnboardingState: SingleUserState<VaultOnboardingTasks> | undefined;

  constructor(private stateProvider: StateProvider) {
    this.stateProvider.activeUserId$.pipe(takeUntil(this.destroy$)).subscribe((userId) => {
      if (userId) {
        this.vaultOnboardingState = this.stateProvider.getUser(userId, VAULT_ONBOARDING_KEY);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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

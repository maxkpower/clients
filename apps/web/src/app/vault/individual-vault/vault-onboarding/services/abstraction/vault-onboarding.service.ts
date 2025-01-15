// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { VaultOnboardingTasks } from "../vault-onboarding.service";

export abstract class VaultOnboardingService {
  abstract setVaultOnboardingTasks(newState: VaultOnboardingTasks): Promise<void>;
  abstract getVaultOnboardingState$(userId: UserId): Observable<VaultOnboardingTasks>;
}

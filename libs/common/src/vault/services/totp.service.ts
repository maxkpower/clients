import { firstValueFrom, map } from "rxjs";

import { TotpResponse } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { TotpService as TotpServiceAbstraction } from "../abstractions/totp.service";

export class TotpService implements TotpServiceAbstraction {
  constructor(private sdkService: SdkService) {}

  async getCode(key: string): Promise<TotpResponse> {
    return await firstValueFrom(
      this.sdkService.client$.pipe(
        map((sdk) => {
          return sdk.vault().totp().generate_totp(key);
        }),
      ),
    );
  }
}

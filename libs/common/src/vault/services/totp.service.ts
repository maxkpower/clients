import { firstValueFrom, map } from "rxjs";

import { CryptoFunctionService } from "../../platform/abstractions/crypto-function.service";
import { LogService } from "../../platform/abstractions/log.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../platform/misc/utils";
import { TotpService as TotpServiceAbstraction } from "../abstractions/totp.service";

export class TotpService implements TotpServiceAbstraction {
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private logService: LogService,
    private sdkService: SdkService,
  ) {}

  async getCode(key: string | undefined): Promise<string | undefined> {
    if (!key) {
      return undefined;
    }

    return await firstValueFrom(
      this.sdkService.client$.pipe(
        map((sdk) => {
          if (sdk === undefined) {
            throw new Error("SDK is undefined");
          }
          return sdk.vault().totp().generate_totp(key);
        }),
        map((totp) => totp.code),
      ),
    );
  }

  getTimeInterval(key: string): number {
    let period = 30;
    if (key != null && key.toLowerCase().indexOf("otpauth://") === 0) {
      const params = Utils.getQueryParams(key);
      const periodParams = params.get("period");
      if (params.has("period") && periodParams) {
        try {
          period = parseInt(periodParams.trim());
        } catch {
          this.logService.error("Invalid period param.");
        }
      }
    }
    return period;
  }
}

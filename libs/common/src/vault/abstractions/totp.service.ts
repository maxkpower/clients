import { TotpResponse } from "@bitwarden/sdk-internal";

export abstract class TotpService {
  abstract getCode(key: string | undefined): Promise<TotpResponse | undefined>;
}

// import { Manager } from "@bitwarden/sdk-internal";

import { SdkService } from "../abstractions/sdk/sdk.service";

export abstract class IpcService {
  // protected manager = new Manager();

  constructor(private sdkService: SdkService) {}

  async init() {}
}

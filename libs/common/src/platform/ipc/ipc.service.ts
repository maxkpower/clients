import { firstValueFrom, map } from "rxjs";

import { Manager } from "@bitwarden/sdk-internal";

import { SdkService } from "../abstractions/sdk/sdk.service";

export abstract class IpcService {
  protected manager: Manager;

  constructor(private sdkService: SdkService) {}

  async init() {
    await firstValueFrom(
      this.sdkService.client$.pipe(map((client) => client.ipc().create_manager())),
    );
  }
}

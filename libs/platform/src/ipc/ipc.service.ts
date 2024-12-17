import { Manager } from "@bitwarden/sdk-internal";

export abstract class IpcService {
  protected manager = new Manager();

  async init() {
    await this.registerLinks(this.manager);
  }

  protected abstract registerLinks(manager: Manager): Promise<void>;
}

import { SshKey } from "@bitwarden/sdk-internal";

export abstract class SshImportPromptService {
  abstract importSshKeyFromClipboard: () => Promise<SshKey>;
}

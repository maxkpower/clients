import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
/**
 * Service responsible for generating random passwords and usernames.
 */
export abstract class CipherFormGenerationService {
  /**
   * Generates a random password. Called when the user clicks the "Generate Password" button in the UI.
   */
  abstract generatePassword(): Promise<string | null>;

  /**
   * Generates a random username. Called when the user clicks the "Generate Username" button in the UI.
   */
  abstract generateUsername(cipher: CipherView): Promise<string | null>;
}

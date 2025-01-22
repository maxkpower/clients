export abstract class CipherFormUriService {
  /**
   * The current URI value
   */
  abstract uri: string;

  /**
   * Updates the current URI
   */
  abstract setUri(uri: string): void;
}

export interface BitwardenIpcWebApi {
  /**
   * Sends a message to the content script.
   * @param payload The message to send.
   */
  postMessage(payload: Uint8Array): void;

  /**
   * The callback to be called when a message is received.
   */
  onMessage?: (payload: Uint8Array) => void;
}

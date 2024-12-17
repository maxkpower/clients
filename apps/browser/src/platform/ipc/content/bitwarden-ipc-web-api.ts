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

export interface IpcMessage {
  type: "bitwarden-ipc-message";
  payload: Uint8Array;
}

export function getBitwardenIpcWebApi(): BitwardenIpcWebApi | undefined {
  return (window as any).Bitwarden;
}

export function isIpcMessage(message: any): message is IpcMessage {
  return message.type === "bitwarden-ipc-message";
}

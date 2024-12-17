export interface IpcMessage {
  type: "bitwarden-ipc-message";
  payload: Uint8Array;
}

export function isIpcMessage(message: any): message is IpcMessage {
  return message.type === "bitwarden-ipc-message";
}

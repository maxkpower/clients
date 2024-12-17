// TODO: This content script should be dynamically reloaded when the extension is updated,
// to avoid "Extension context invalidated." errors.

import { isIpcMessage } from "@bitwarden/common/platform/ipc/ipc-message";

export function sendExtensionMessage(message: unknown) {
  if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined" &&
    typeof browser.runtime.sendMessage !== "undefined"
  ) {
    void browser.runtime.sendMessage(message);
    return;
  }

  void chrome.runtime.sendMessage(message);
}

window.addEventListener("message", (event) => {
  if (isIpcMessage(event.data)) {
    sendExtensionMessage(event.data);
  }
});

import { css, cache } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { NotificationBarIframeInitData, NotificationTypes } from "../../../notification/abstractions/notification-bar";
import { define } from "../utils/define";
import { createAutofillOverlayCipherDataMock } from "../../../spec/autofill-mocks";
import { CipherItem } from "../cipher";
import { CipherData } from "../cipher/types";
import { themes, spacing } from "../constants/styles";
import { ActionRow } from "../rows/action-row";
import { ButtonRow } from "../rows/button-row";
import { ItemRow } from "../rows/item-row";

import { NotificationBody } from "./body";
import { NotificationFooter } from "./footer";
import { NotificationHeader } from "./header";

// import { NotificationHeader } from "./header";

// import "./header";

export function NotificationContainer({
  handleCloseNotification,
  i18n,
  isVaultLocked,
  theme,
  type,
}: { handleCloseNotification: (e: Event) => void } & {
  i18n: { [key: string]: string };
} & NotificationBarIframeInitData) {
  const headerMessage = getHeaderMessage(type, i18n);
  const showBody = true;

  const cipher = {
    id: "inline-menu-cipher-0",
    name: "fedex.com/secure-login",
    type: 1,
    reprompt: 0,
    favorite: false,
    icon: {
      imageEnabled: true,
      image: "https://localhost:8443/icons/www.fedex.com/icon.png",
      icon: "bwi-globe",
    },
    accountCreationFieldType: "text",
    login: {
      username: "bwplaywright@gmail.com",
    },
  } as CipherData;
  // @TODO remove mock ciphers for development
  const ciphers = [
    cipher,
    createAutofillOverlayCipherDataMock(1),
    { ...createAutofillOverlayCipherDataMock(2), icon: { imageEnabled: false } },
    {
      ...createAutofillOverlayCipherDataMock(3),
      icon: { imageEnabled: true, image: "https://localhost:8443/icons/webtests.dev/icon.png" },
    },
  ] as CipherData[];
  const itemText = type === NotificationTypes.Add ? "Save as new login" : null;

      // ${NotificationHeader({
      //   handleCloseNotification,
      //   standalone: showBody,
      //   isVaultLocked,
      //   message: headerMessage,
      //   theme,
      // })}
  return html`
    <div class=${notificationContainerStyles(theme)}>
      <notification-header
        .handleCloseNotification="${handleCloseNotification}"
        hasBody="${showBody}"
        isVaultLocked="${isVaultLocked}"
        message="${headerMessage}"
      ></notification-header>
      ${showBody
        ? NotificationBody({
            theme,
            customClasses: [notificationBodyClass],
            // @TODO move notificationType to `NotificationBody` component
            children: ciphers.map((cipher) =>
              ItemRow({
                theme,
                children: CipherItem({
                  cipher,
                  notificationType: type,
                  theme,
                  handleAction: () => {
                    window.alert("cipher item button pressed!");
                  },
                }),
              }),
            ),
          })
        : null}
      ${NotificationFooter({
        theme,
        children: [
          type === NotificationTypes.Change
            ? ActionRow({ itemText, handleAction: () => {}, theme })
            : ButtonRow({ theme }),
        ],
      })}
    </div>
  `;
}

// @TODO eh, this smells
const notificationBodyClass = "notification-body";

const notificationContainerStyles = (theme: Theme) => css`
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background-color: ${themes[theme].background.alt};
  width: 400px;

  > [class*="notification-header-"] {
    border-radius: ${spacing["4"]} ${spacing["4"]} 0 0;
  }

  > .${notificationBodyClass} {
    margin: ${spacing["3"]} 0 ${spacing["1.5"]} ${spacing["3"]};
    padding-right: ${spacing["3"]};
  }
`;

function getHeaderMessage(type: string, i18n: { [key: string]: string }) {
  switch (type) {
    case NotificationTypes.Add:
      return i18n.saveAsNewLoginAction;
    case NotificationTypes.Change:
      return i18n.updateLoginPrompt;
    case NotificationTypes.Unlock:
      return "";
    case NotificationTypes.FilelessImport:
      return "";
    default:
      return null;
  }
}

define('notification-container', NotificationContainer);

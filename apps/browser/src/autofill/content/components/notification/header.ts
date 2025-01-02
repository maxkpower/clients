// import { css } from "@emotion/css";
import createEmotion from '@emotion/css/create-instance';
import { ContextConsumer } from "@lit/context";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { themeContext } from "../contexts/theme";
import { BrandIcon } from "../brand-icon";
import { CloseButton } from "../buttons/close-button";
import { themes } from "../constants/styles";

import { NotificationHeaderMessage } from "./header-message";

const { css } = createEmotion({
  key: 'notification-header'
})

export function NotificationHeader({
  isVaultLocked,
  message,
  standalone,
  contextTheme,
  // theme = ThemeTypes.Light,
  handleCloseNotification,
}: {
  isVaultLocked: boolean;
  message: string;
  standalone: boolean;
  contextTheme?: {type: Theme};
  // theme: Theme;
  handleCloseNotification: (e: Event) => void;
}) {
  console.log('handleCloseNotification:', handleCloseNotification);
  const showIcon = true;
  const isDismissable = true;

  const theme = contextTheme.type;


  return html`
    <div class=${notificationHeaderStyles({ standalone, theme })}>
      ${showIcon ? BrandIcon({ theme }) : null} ${NotificationHeaderMessage({ message, theme })}
      ${isDismissable ? CloseButton({ handleCloseNotification, theme }) : null}
    </div>
  `;
}

const notificationHeaderStyles = ({
  standalone,
  theme,
}: {
  standalone: boolean;
  theme: Theme;
}) => css`
  gap: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${themes[theme].background.alt};
  padding: 12px 16px 8px 16px;
  white-space: nowrap;

  ${standalone
    ? css`
        border-bottom: 0.5px solid ${themes[theme].secondary["300"]};
      ` : css``}
`;

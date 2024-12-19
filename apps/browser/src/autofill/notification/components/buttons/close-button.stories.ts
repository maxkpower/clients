// import { Meta, StoryObj } from "@storybook/web-components";

// import { AvatarComponent } from "./avatar.component";
import { render, html } from "lit";

import {CloseButton} from "./close-button";

export default {
  title: "Notification Bar Close Button",
  render: (args: any) => html`<div>test</div>`,
}

// type Story = StoryObj<typeof CloseButton>;

export const Primary = {
  args: {
    handleCloseNotification: () => {},
    theme: 'light',
  },
};

// export const Large: Story = {
//   args: {
//     size: "large",
//   },
// };

// export const Small: Story = {
//   args: {
//     size: "small",
//   },
// };

// export const LightBackground: Story = {
//   args: {
//     color: "#d2ffcf",
//   },
// };

// export const Border: Story = {
//   args: {
//     border: true,
//   },
// };

// export const ColorByID: Story = {
//   args: {
//     id: "236478",
//   },
// };

// export const ColorByText: Story = {
//   args: {
//     text: "Jason Doe",
//   },
// };

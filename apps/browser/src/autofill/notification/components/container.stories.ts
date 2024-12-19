// import { Meta, StoryObj } from "@storybook/angular";

// import { AvatarComponent } from "./avatar.component";
import {NotificationContainer} from "./container";

export default {
  title: "Notification Container",
  render: (args: any) => NotificationContainer(args),
}

// type Story = StoryObj<typeof NotificationContainer>;

export const Primary = {
  args: {
    handleCloseNotification: () => {},
    i18n: {},
    isVaultLocked: false,
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

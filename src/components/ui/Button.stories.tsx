import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Primary CTA",
    variant: "contained",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Outlined: Story = {
  args: {
    variant: "outlined",
    children: "Secondary",
  },
};

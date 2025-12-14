import type { Preview } from "@storybook/nextjs";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createAppTheme } from "@/styles/theme";
import React from "react";

const preview: Preview = {
  decorators: [
    (StoryComponent) => (
      <ThemeProvider theme={createAppTheme("light")}>
        <CssBaseline />
        <StoryComponent />
      </ThemeProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

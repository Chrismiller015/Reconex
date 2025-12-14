"use client";

import { CacheProvider } from "@emotion/react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { createAppTheme } from "@/styles/theme";
import { createEmotionCache } from "@/styles/createEmotionCache";
import { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";

const createThemeRegistry = () => {
  const cache = createEmotionCache();
  cache.compat = true;
  const theme = createAppTheme("light");

  return { cache, theme };
};

export const ThemeRegistry = ({ children }: { children: ReactNode }) => {
  const { cache, theme } = createThemeRegistry();

  useServerInsertedHTML(() => (
    <style
      data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(" ")}`}
      dangerouslySetInnerHTML={{ __html: Object.values(cache.inserted).join("") }}
    />
  ));

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ body: { backgroundColor: theme.palette.background.default } }} />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
};

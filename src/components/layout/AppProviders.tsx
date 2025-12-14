"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import type { Session } from "next-auth";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { NotificationProvider } from "@/components/layout/NotificationProvider";
import { useUiStore } from "@/store/uiStore";
import { createAppTheme } from "@/styles/theme";

export const AppProviders = ({ children, session }: { children: ReactNode; session: Session | null }) => {
  const mode = useUiStore((state) => state.themeMode);
  const [queryClient] = useState(() => new QueryClient());
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const root = document.documentElement;

    const previousBodyBg = body.style.backgroundColor;
    const previousBodyColor = body.style.color;
    const previousRootBg = root.style.backgroundColor;

    const nextBg = theme.palette.background.default;
    const nextText = theme.palette.text.primary;

    body.style.backgroundColor = nextBg;
    body.style.color = nextText;
    root.style.backgroundColor = nextBg;

    return () => {
      body.style.backgroundColor = previousBodyBg;
      body.style.color = previousBodyColor;
      root.style.backgroundColor = previousRootBg;
    };
  }, [theme]);

  return (
    <AuthProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles
            styles={{
              body: {
                transition: "background-color 0.3s ease, color 0.3s ease",
              },
            }}
          />
          <NotificationProvider>
            <AuthGate>{children}</AuthGate>
          </NotificationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
};

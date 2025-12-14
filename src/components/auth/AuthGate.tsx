"use client";

import { LoginButton } from "@/components/auth/LoginButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";
import { useSession } from "next-auth/react";

const FullscreenSection = ({ children }: { children: ReactNode }) => (
  <Box
    component="main"
    sx={{
      minHeight: {
        xs: "calc(100vh - 56px)",
        sm: "calc(100vh - 64px)",
      },
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      px: 2,
      backgroundColor: "background.default",
    }}
  >
    {children}
  </Box>
);

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <>
        <AppHeader />
        <AppSidebar />
        <FullscreenSection>
          <Stack alignItems="center" spacing={2}>
            <CircularProgress color="primary" />
            <Typography variant="body1" color="text.secondary">
              Checking your session…
            </Typography>
          </Stack>
        </FullscreenSection>
      </>
    );
  }

  if (status !== "authenticated") {
    return (
      <>
        <AppHeader />
        <AppSidebar />
        <FullscreenSection>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography variant="h5">Please login to google to access this page</Typography>
            <LoginButton />
          </Stack>
        </FullscreenSection>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <AppSidebar />
      {children}
    </>
  );
};

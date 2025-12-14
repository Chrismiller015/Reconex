"use client";

import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import { SnackbarProvider, closeSnackbar } from "notistack";
import { ReactNode } from "react";

export const NotificationProvider = ({ children }: { children: ReactNode }) => (
  <SnackbarProvider
    maxSnack={3}
    preventDuplicate
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    autoHideDuration={4000}
    action={(snackbarId) => (
      <IconButton
        size="small"
        color="inherit"
        aria-label="Dismiss notification"
        onClick={() => closeSnackbar(snackbarId)}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    )}
  >
    {children}
  </SnackbarProvider>
);

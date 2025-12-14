"use client";

import { Button as MuiButton, ButtonProps, CircularProgress } from "@mui/material";
import { forwardRef } from "react";

type AppButtonProps = ButtonProps & {
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, AppButtonProps>(function Button(
  { children, loading, disabled, ...props },
  ref,
) {
  return (
    <MuiButton ref={ref} disabled={disabled || loading} {...props}>
      {loading && <CircularProgress size={16} sx={{ mr: 1 }} aria-hidden />}
      {children}
    </MuiButton>
  );
});

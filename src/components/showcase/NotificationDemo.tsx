"use client";

import { Stack } from "@mui/material";
import { useSnackbar } from "notistack";
import { Button } from "@/components/ui/Button";

export const NotificationDemo = () => {
  const { enqueueSnackbar } = useSnackbar();

  const trigger = (variant: "default" | "success" | "info" | "warning" | "error") => {
    const titles: Record<typeof variant, string> = {
      default: "Heads up! Something happened.",
      success: "Saved changes successfully.",
      info: "FYI: Syncing the latest data...",
      warning: "Check the form for potential issues.",
      error: "Something went wrong while saving.",
    };
    enqueueSnackbar(titles[variant], { variant });
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      <Button size="small" variant="outlined" onClick={() => trigger("default")}>
        Notify
      </Button>
      <Button size="small" variant="outlined" color="success" onClick={() => trigger("success")}>
        Success
      </Button>
      <Button size="small" variant="outlined" color="info" onClick={() => trigger("info")}>
        Info
      </Button>
      <Button size="small" variant="outlined" color="warning" onClick={() => trigger("warning")}>
        Warning
      </Button>
      <Button size="small" variant="outlined" color="error" onClick={() => trigger("error")}>
        Error
      </Button>
    </Stack>
  );
};

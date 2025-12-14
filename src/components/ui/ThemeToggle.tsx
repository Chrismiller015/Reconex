"use client";

import { useUiStore } from "@/store/uiStore";
import { IconButton, Tooltip } from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

export const ThemeToggle = () => {
  const mode = useUiStore((state) => state.themeMode);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  return (
    <Tooltip title="Toggle theme">
      <IconButton color="inherit" onClick={toggleTheme} sx={{ border: 1, borderColor: "divider" }}>
        {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </Tooltip>
  );
};

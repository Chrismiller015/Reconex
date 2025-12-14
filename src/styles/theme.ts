import { createTheme, PaletteMode } from "@mui/material";

const basePalette = {
  primary: {
    main: "#2563eb",
    contrastText: "#ffffff",
  },
  secondary: {
    main: "#f97316",
    contrastText: "#0f172a",
  },
};

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...basePalette,
      background: {
        default: mode === "light" ? "#f8fafc" : "#020617",
        paper: mode === "light" ? "#ffffff" : "#0f172a",
      },
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
      h1: {
        fontSize: "2.25rem",
        fontWeight: 600,
      },
      body1: {
        lineHeight: 1.6,
      },
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            textTransform: "none",
          },
        },
      },
    },
  });

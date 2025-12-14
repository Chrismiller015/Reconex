"use client";

import MenuIcon from "@mui/icons-material/Menu";
import { AppBar, Box, IconButton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import { useUiStore } from "@/store/uiStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LinkButton } from "@/components/ui/LinkButton";
import Link from "next/link";

const PlaceholderIcon = () => (
  <Box
    sx={{
      width: 36,
      height: 36,
      borderRadius: 2,
      background: (theme) =>
        theme.palette.mode === "light"
          ? "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)"
          : "linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "common.white",
      fontWeight: 700,
      letterSpacing: 0.5,
      fontSize: 14,
    }}
  >
    BI
  </Box>
);

export const AppHeader = () => {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const navLinks = [
    { label: "Welcome", href: "/" },
    { label: "File Library", href: "/files" },
    { label: "New Compare", href: "/compare/new" },
    { label: "Compare Runs", href: "/runs" },
    { label: "Settings", href: "/settings" },
  ];

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="inherit"
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: (theme) =>
          theme.palette.mode === "light" ? theme.palette.background.paper : theme.palette.background.default,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Tooltip title="Toggle navigation">
          <IconButton edge="start" color="inherit" onClick={toggleSidebar} size="large" sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        </Tooltip>

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          component={Link}
          href="/"
          sx={{ flexShrink: 0, textDecoration: "none", color: "inherit" }}
        >
          <PlaceholderIcon />
          <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.4 }}>
            ReconEx
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
          {navLinks.map((link) => (
            <LinkButton key={link.href} href={link.href} size="small" variant="text" color="inherit">
              {link.label}
            </LinkButton>
          ))}
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={1.5} alignItems="center">
          <ThemeToggle />
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

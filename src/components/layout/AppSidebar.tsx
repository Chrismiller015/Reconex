"use client";

import { Divider, Drawer, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useUiStore } from "@/store/uiStore";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Components", href: "/components" },
];

export const AppSidebar = () => {
  const open = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  return (
    <Drawer anchor="left" open={open} onClose={() => setSidebarOpen(false)}>
      <Stack sx={{ width: 260, p: 2 }} spacing={2}>
        <Typography variant="h6" fontWeight={600}>
          Navigation
        </Typography>
        <Divider />
        <List component="nav" disablePadding>
          {navLinks.map((item) => (
            <ListItemButton
              key={item.label}
              component={Link}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ mt: "auto" }} />
        <Typography variant="body2" color="text.secondary">
          Customize this menu with links relevant to your product.
        </Typography>
      </Stack>
    </Drawer>
  );
};

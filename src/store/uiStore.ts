import { PaletteMode } from "@mui/material";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UiStore = {
  themeMode: PaletteMode;
  sidebarOpen: boolean;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      themeMode: "light",
      sidebarOpen: false,
      toggleTheme: () =>
        set((state) => ({
          themeMode: state.themeMode === "light" ? "dark" : "light",
        })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () =>
        set((state) => ({
          sidebarOpen: !state.sidebarOpen,
        })),
    }),
    {
      name: "ui-preferences",
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => localStorage)
          : undefined,
      partialize: (state) => ({
        themeMode: state.themeMode,
      }),
    }
  )
);

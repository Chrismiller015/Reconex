"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ReactNode } from "react";

export const AuthGate = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <AppHeader />
      <AppSidebar />
      {children}
    </>
  );
};

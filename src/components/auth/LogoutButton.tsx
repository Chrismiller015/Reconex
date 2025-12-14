"use client";

import { Button } from "@/components/ui/Button";
import { signOut, useSession } from "next-auth/react";

export const LogoutButton = () => {
  const { status } = useSession();

  if (status !== "authenticated") {
    return null;
  }

  return (
    <Button variant="outlined" color="secondary" onClick={() => signOut()}>
      Sign out
    </Button>
  );
};

"use client";

import { Button } from "@/components/ui/Button";
import { signIn, useSession } from "next-auth/react";

export const LoginButton = () => {
  const { status } = useSession();

  if (status === "authenticated") {
    return null;
  }

  return (
    <Button variant="contained" color="primary" onClick={() => signIn("google")}>
      Sign in with Google
    </Button>
  );
};

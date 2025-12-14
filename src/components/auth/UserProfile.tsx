"use client";

import { Avatar, Card, CardContent, Stack, Typography } from "@mui/material";
import { useSession } from "next-auth/react";

export const UserProfile = () => {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session.user) {
    return null;
  }

  const email = session.user.email ?? "Unknown email";
  const name = session.user.name ?? email;
  const image = session.user.image ?? undefined;
  const initials = (name || email).charAt(0).toUpperCase();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={image} alt={name} sx={{ width: 48, height: 48 }}>
            {initials}
          </Avatar>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Logged in as
            </Typography>
            <Typography variant="h6">{name}</Typography>
            <Typography variant="body2">{email}</Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

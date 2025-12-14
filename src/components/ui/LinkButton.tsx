"use client";

import NextLink from "next/link";
import { Button, type ButtonProps } from "@mui/material";

type LinkButtonProps = ButtonProps & {
  href: string;
};

export const LinkButton = ({ href, children, ...props }: LinkButtonProps) => (
  <Button href={href} LinkComponent={NextLink} {...props}>
    {children}
  </Button>
);

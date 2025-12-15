import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/env.mjs";
import { AppProviders } from "@/components/layout/AppProviders";
import { EmotionCacheProvider } from "@/components/layout/EmotionCacheProvider";

// Self-hosted fonts to avoid 3-4 minute network timeouts during Docker builds in Coolify.
// Keep the historical CSS variable names (`--font-geist-*`) so existing global CSS/theme continue to work.
const appSans = localFont({
  src: "../../public/fonts/inter-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  fallback: ["system-ui", "arial"],
});

const appMono = localFont({
  src: "../../public/fonts/roboto-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["monospace"],
});

export const metadata: Metadata = {
  title: "ReconEx",
  description: "ReconEx: billing reconciliation and variance investigation.",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>
        <EmotionCacheProvider>
          <AppProviders>{children}</AppProviders>
        </EmotionCacheProvider>
      </body>
    </html>
  );
}

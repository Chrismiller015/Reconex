import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/env.mjs";
import { AppProviders } from "@/components/layout/AppProviders";
import { EmotionCacheProvider } from "@/components/layout/EmotionCacheProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReconEx",
  description: "ReconEx: billing reconciliation and variance investigation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <EmotionCacheProvider>
          <AppProviders>{children}</AppProviders>
        </EmotionCacheProvider>
      </body>
    </html>
  );
}

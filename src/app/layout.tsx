import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import "@/env.mjs";
import { AppProviders } from "@/components/layout/AppProviders";
import { EmotionCacheProvider } from "@/components/layout/EmotionCacheProvider";

const appSans = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const appMono = Roboto_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
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

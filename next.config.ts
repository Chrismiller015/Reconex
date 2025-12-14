import type { NextConfig } from "next";

const allowedOrigins = new Set<string>(["localhost:3000"]);
const originCandidates = [
  process.env.NEXTAUTH_URL,
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_APP_URL,
];

for (const candidate of originCandidates) {
  if (!candidate) continue;
  try {
    const url = new URL(candidate);
    if (url.host) {
      allowedOrigins.add(url.host);
    }
  } catch {
    // ignore invalid URLs
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: Array.from(allowedOrigins),
    },
  },
  output: "standalone",
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = (() => {
  const allowedOrigins = new Set(["localhost:3000"]);
  const originCandidates = [
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const candidate of originCandidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.host) allowedOrigins.add(url.host);
    } catch {
      // ignore invalid URLs
    }
  }

  return {
    reactStrictMode: true,
    experimental: {
      serverActions: {
        allowedOrigins: Array.from(allowedOrigins),
      },
    },
    output: "standalone",
  };
})();

export default nextConfig;




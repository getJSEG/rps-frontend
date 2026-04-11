import type { NextConfig } from "next";

const spacesImageHost = process.env.NEXT_PUBLIC_DO_SPACES_IMAGE_HOST?.trim();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "localhost", port: "8080", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8080", pathname: "/uploads/**" },
      { protocol: "https", hostname: "balanced-bravery-production-429e.up.railway.app", pathname: "/uploads/**" },
      ...(spacesImageHost
        ? [{ protocol: "https" as const, hostname: spacesImageHost, pathname: "/**" }]
        : []),
    ],
    unoptimized: false,
  },
};

export default nextConfig;

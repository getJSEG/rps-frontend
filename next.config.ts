import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/uploads/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "balanced-bravery-production-429e.up.railway.app", pathname: "/uploads/**" },
    ],
    unoptimized: false,
  },
};

export default nextConfig;

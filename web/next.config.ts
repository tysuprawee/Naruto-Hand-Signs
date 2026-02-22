import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "media.discordapp.net" },
      { protocol: "https", hostname: "images-ext-1.discordapp.net" },
      { protocol: "https", hostname: "images-ext-2.discordapp.net" },
    ],
  },
};

export default nextConfig;

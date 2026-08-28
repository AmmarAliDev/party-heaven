import type { NextConfig } from "next";

import { STOREFRONT_IMAGE_REMOTE_PATTERNS } from "./src/config/image-hosts";
import { getSecurityHeaders, getServerActionAllowedOrigins } from "./src/config/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86_400,
    // Single source of truth shared with the storefront image URL normalizer so
    // unconfigured hosts fall back to the placeholder instead of crashing.
    remotePatterns: STOREFRONT_IMAGE_REMOTE_PATTERNS,
  },
  experimental: {
    serverActions: {
      allowedOrigins: getServerActionAllowedOrigins(),
      bodySizeLimit: "1mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate build folder lets tests and the offline check run next to a dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@qvac/sdk", "@qvac/inference"],
  experimental: {
    agentFeedback: false,
  },
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/empty-module.js",
    },
  },
  serverExternalPackages: ["pdfkit", "pdfjs-dist"],
  /* config options here */
};

export default nextConfig;

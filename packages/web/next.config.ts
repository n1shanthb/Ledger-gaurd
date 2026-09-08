import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const graphDataEntry = path.resolve(root, "../graph-data/src/index.ts");

const nextConfig: NextConfig = {
  // Import sibling package sources (packages/graph-data) from web
  experimental: {
    externalDir: true,
  },
  transpilePackages: [
    "@lga/graph-data",
    "@ledgerhq/device-management-kit",
    "@ledgerhq/device-signer-kit-ethereum",
    "@ledgerhq/device-transport-kit-web-hid",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@lga/graph-data": graphDataEntry,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node modules — never bundle, require at runtime
  serverExternalPackages: ["sharp"],
  turbopack: {
    // its-fine v2 is ESM-only; alias to its CJS build so Turbopack can bundle it
    resolveAlias: {
      "its-fine": "its-fine/dist/index.cjs",
    },
  },
};

export default nextConfig;

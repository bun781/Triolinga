import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: []
  },
  serverExternalPackages: ["@electric-sql/pglite"]
};

export default nextConfig;

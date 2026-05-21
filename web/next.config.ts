import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@prawko/config", "@prawko/schemas"],
};

export default nextConfig;

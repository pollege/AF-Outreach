import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true, // Often helpful in rapid dev
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;

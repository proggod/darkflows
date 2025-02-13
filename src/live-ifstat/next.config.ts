import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is now stable for development
  experimental: {
    // Add any needed experimental features here
  },
  // Configure redirects and rewrites if needed
  async rewrites() {
    return [];
  },
  // Disable static page generation for API routes
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  }
};

export default nextConfig;

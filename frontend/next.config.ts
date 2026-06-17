import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  async rewrites() {
    const apiOrigin = process.env.NEST_API_URL || "http://localhost:4000";

    return {
      beforeFiles: [
        {
          source: "/api/auth/register",
          destination: `${apiOrigin}/api/auth/register`,
        },
        {
          source: "/api/:path((?!auth(?:/|$)).*)",
          destination: `${apiOrigin}/api/:path*`,
        },
      ],
    };
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0);
}

const deploymentId =
  firstNonEmpty(
    process.env.NEXT_DEPLOYMENT_ID,
    process.env.NEXT_PUBLIC_EMBERDEX_BUILD_ID,
    process.env.GIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA
  ) ?? `local-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  deploymentId,
  env: {
    NEXT_PUBLIC_EMBERDEX_BUILD_ID: deploymentId,
  },
  generateBuildId: async () => deploymentId,
  transpilePackages: ["@emberdex/core", "@emberdex/content"],
  images: {
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "assets.pokemon.com",
      },
      {
        protocol: "https",
        hostname: "pokeapi.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        source: "/api/pokemon/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

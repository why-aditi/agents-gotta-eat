// Deployed on Vercel with Root Directory = apps/web.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gottaeat/schemas"],
  // Lint runs once from the repo root (`pnpm lint`), which has the Next rules.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

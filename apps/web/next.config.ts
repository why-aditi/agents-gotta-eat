// Deployed on Vercel with Root Directory = apps/web.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Local dev reads the repo-root .env, like the api does. Variables already set win; Vercel has no such file.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ["@gottaeat/schemas"],
  // Lint runs once from the repo root (`pnpm lint`), which has the Next rules.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

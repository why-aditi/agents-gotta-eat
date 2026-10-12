import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import { REPLAYED_HEADER } from "./idempotency";

// WEB_ORIGINS is comma-separated. A `*` inside an entry matches one DNS label fragment,
// e.g. https://agents-gotta-eat-*.vercel.app matches preview deploys but not other domains.
export function parseOrigins(value: string | undefined): (string | RegExp)[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .map((entry) => {
      if (!entry.includes("*")) return entry;
      const pattern = entry
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
        .join("[A-Za-z0-9-]*");
      return new RegExp(`^${pattern}$`);
    });
}

export function registerCors(app: FastifyInstance, webOrigins: string | undefined) {
  const origins = parseOrigins(webOrigins);
  app.register(cors, {
    // No origins configured means no cross-origin access.
    origin: origins.length ? origins : false,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    exposedHeaders: [REPLAYED_HEADER],
    maxAge: 600,
  });
}

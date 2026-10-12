import Fastify from "fastify";
import type { HealthResponse } from "@gottaeat/schemas";
import pkg from "../package.json" with { type: "json" };

export function buildApp(opts?: { logger?: boolean }) {
  const app = Fastify({ logger: opts?.logger ?? true });

  app.get("/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "api",
    version: pkg.version,
  }));

  return app;
}

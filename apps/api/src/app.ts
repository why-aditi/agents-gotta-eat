import Fastify, { type FastifyServerOptions } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { HealthResponse } from "@gottaeat/schemas";
import pkg from "../package.json" with { type: "json" };
import type { Db } from "./db";
import { registerAuth } from "./http/auth";
import { registerCors } from "./http/cors";
import { registerErrorHandlers } from "./http/errors";
import { registerIdempotency } from "./http/idempotency";
import { registerOpenApi, registerOpenApiRoute } from "./http/openapi";
import { arenaRoutes, registerArenaHooks } from "./modules/arena";
import { identityRoutes } from "./modules/identity";
import { mcpRoutes } from "./modules/mcp";
import { policyRoutes } from "./modules/policy";

export interface AppEnv {
  API_JWT_SECRET: string;
  WEB_ORIGINS?: string;
  API_URL?: string;
  PUBLIC_API_URL?: string;
  // Gate 2 stub until pm-06: "allow", or anything else for "ask".
  POLICY_GATE2_STUB?: string;
  // "true" enables POST /v1/admin/wallets/:userId/credit (dev money until pm-04).
  ALLOW_DEV_CREDIT?: string;
  // "true" enables POST /v1/admin/bounties/:id/open (dev escrow until pm-04).
  ALLOW_DEV_FUNDING?: string;
  // The agents service's wake URL (POSTed when a bounty opens) and its shared secret. Unset URL → no call.
  AGENTS_WAKE_URL?: string;
  AGENTS_WAKE_SECRET?: string;
}

export interface BuildAppOptions {
  db: Db;
  env: AppEnv;
  logger?: FastifyServerOptions["logger"];
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    env: AppEnv;
  }
}

export function buildApp(opts: BuildAppOptions) {
  const app = Fastify({ logger: opts.logger ?? true }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("db", opts.db);
  app.decorate("env", opts.env);
  // Policy tells the arena when an entry stake settles or is released.
  registerArenaHooks();

  // Root-level hooks, so they apply to every route registered below or later.
  registerErrorHandlers(app);
  registerAuth(app, { db: opts.db, jwtSecret: opts.env.API_JWT_SECRET });
  registerIdempotency(app, { db: opts.db });

  // Both are fastify-plugin wrapped, so they apply at the root. Plugins load in order:
  // swagger must load before the route plugin below so its onRoute hook sees every route.
  registerCors(app, opts.env.WEB_ORIGINS);
  registerOpenApi(app);

  app.register(async (api) => {
    const r = api.withTypeProvider<ZodTypeProvider>();
    r.get("/health", { config: { auth: "none" }, schema: { response: { 200: HealthResponse } } }, async () => ({
      ok: true as const,
      service: "api",
      version: pkg.version,
    }));
    registerOpenApiRoute(api);

    // Route modules go here, one register per module. Each declares config.auth on every route.
    await api.register(identityRoutes);
    await api.register(policyRoutes);
    await api.register(arenaRoutes);
    await api.register(mcpRoutes);
  });

  return app;
}

export type App = ReturnType<typeof buildApp>;

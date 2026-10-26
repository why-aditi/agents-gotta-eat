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
import { adminRoutes } from "./modules/admin";
import { demoRoutes } from "./modules/demo";
import { arenaRoutes, registerArenaHooks } from "./modules/arena";
import { DEFAULT_HEARTBEAT_MS, EventBus, eventsRoutes } from "./modules/events";
import { identityRoutes } from "./modules/identity";
import { mcpRoutes } from "./modules/mcp";
import { paymentsRoutes } from "./modules/payments";
import { policyRoutes } from "./modules/policy";

export interface AppEnv {
  API_JWT_SECRET: string;
  WEB_ORIGINS?: string;
  API_URL?: string;
  PUBLIC_API_URL?: string;
  // Gate 2 stub: "allow", or anything else for "ask". When set it wins over the LLM intent check.
  POLICY_GATE2_STUB?: string;
  // LLM gateway (LiteLLM proxy). Unset: no compile (502), gate 2 asks, no AI ranking.
  GATEWAY_URL?: string;
  LITELLM_MASTER_KEY?: string;
  // Global daily cap on gateway requests (default 1000).
  LLM_DAILY_REQUEST_BUDGET?: string;
  // "true" enables POST /v1/admin/wallets/:userId/credit (dev money until pm-04).
  ALLOW_DEV_CREDIT?: string;
  // "true" enables POST /v1/admin/bounties/:id/open (dev escrow until pm-04).
  ALLOW_DEV_FUNDING?: string;
  // PayPal webhook id the signature check runs against (PAYPAL_WEBHOOK_ID).
  PAYPAL_WEBHOOK_ID?: string;
  // The agents service's wake URL (POSTed when a bounty opens) and its shared secret. Unset URL → no call.
  AGENTS_WAKE_URL?: string;
  AGENTS_WAKE_SECRET?: string;
  // Proxy hops in front of the api (Render: 1), so req.ip is the client for the demo rate limit. Unset: none.
  TRUST_PROXY_HOPS?: string;
}

export interface DemoOptions {
  // Requests per minute per IP across /v1/demo/* (default 30).
  rateLimit?: number;
  // Where the demo reset reads seed bounties (default: seed/bounties at the repo root).
  seedDir?: string;
}

export interface BuildAppOptions {
  db: Db;
  env: AppEnv;
  logger?: FastifyServerOptions["logger"];
  // The SSE fan-out. buildApp makes one that isn't polling; server.ts starts it (tests poll it by hand).
  eventBus?: EventBus;
  eventsHeartbeatMs?: number;
  demo?: DemoOptions;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    env: AppEnv;
    eventBus: EventBus;
    eventsHeartbeatMs: number;
    demoOptions: DemoOptions;
  }
}

export function buildApp(opts: BuildAppOptions) {
  const hops = Number.parseInt(opts.env.TRUST_PROXY_HOPS ?? "", 10);
  const app = Fastify({
    logger: opts.logger ?? true,
    // Trusts the first `hops` proxies in X-Forwarded-For (proxy-addr's hop count, as a function for the types).
    ...(Number.isInteger(hops) && hops > 0 ? { trustProxy: (_addr: string, i: number) => i < hops } : {}),
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("db", opts.db);
  app.decorate("env", opts.env);
  app.decorate("eventBus", opts.eventBus ?? new EventBus(opts.db));
  app.decorate("eventsHeartbeatMs", opts.eventsHeartbeatMs ?? DEFAULT_HEARTBEAT_MS);
  app.decorate("demoOptions", opts.demo ?? {});
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
    await api.register(paymentsRoutes);
    await api.register(eventsRoutes);
    await api.register(mcpRoutes);
    await api.register(adminRoutes);
    await api.register(demoRoutes, { rateLimit: opts.demo?.rateLimit });
  });

  return app;
}

export type App = ReturnType<typeof buildApp>;

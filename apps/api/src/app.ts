import Fastify, { type FastifyServerOptions } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { HealthResponse } from "@gottaeat/schemas";
import pkg from "../package.json" with { type: "json" };
import type { Db } from "./db";
import { registerAuth } from "./http/auth";
import { registerCors } from "./http/cors";
import { clientErrorHandler, frameworkErrorHandler, registerErrorHandlers } from "./http/errors";
import { registerInputGuard } from "./http/input-guard";
import { registerIdempotency } from "./http/idempotency";
import { registerJsonBodyParser } from "./http/json-body";
import { registerOpenApi, registerOpenApiRoute } from "./http/openapi";
import { registerRateLimit } from "./http/rate-limit";
import { adminRoutes } from "./modules/admin";
import { demoRoutes } from "./modules/demo";
import { arenaRoutes, registerArenaHooks } from "./modules/arena";
import { DEFAULT_HEARTBEAT_MS, EventBus, eventsRoutes } from "./modules/events";
import { identityRoutes } from "./modules/identity";
import { mcpRoutes } from "./modules/mcp";
import { notifyPlugin } from "./modules/notify";
import { paymentsRoutes } from "./modules/payments";
import { policyRoutes } from "./modules/policy";

export interface AppEnv {
  API_JWT_SECRET: string;
  WEB_ORIGINS?: string;
  API_URL?: string;
  PUBLIC_API_URL?: string;
  // Render sets this to the service's public URL; the fallback for links when PUBLIC_API_URL is unset.
  RENDER_EXTERNAL_URL?: string;
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
  // Requests a minute per caller (agent key, else IP) and failed-auth responses a minute per IP. Defaults 1200 and 20;
  // "0" turns a limit off. Tests and load runs set 0.
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_AUTH_FAIL_PER_MINUTE?: string;
  // hard-01's name for the failed-auth limit (default 20). RATE_LIMIT_AUTH_FAIL_PER_MINUTE wins when both are set,
  // so the e2e and load configs (which set it to 0) keep working.
  AUTH_FAIL_LIMIT?: string;
  // Email (Resend). Unset key: no email is sent. EMAIL_FROM and WEB_URL (link target) have defaults;
  // RESEND_API_URL is for tests.
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  WEB_URL?: string;
  RESEND_API_URL?: string;
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
    frameworkErrors: frameworkErrorHandler,
    // Node calls this for requests it cannot parse (431 and the like), before Fastify sees them.
    clientErrorHandler,
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
  registerInputGuard(app);
  // Empty JSON body = no body; bodies nested past MAX_JSON_DEPTH are a 400 before anything walks them.
  registerJsonBodyParser(app);
  // Before auth, so a flood of bad credentials is cut off before they are checked.
  const registerPrincipalLimit = registerRateLimit(app, {
    perMinute: opts.env.RATE_LIMIT_PER_MINUTE,
    authFailPerMinute: opts.env.RATE_LIMIT_AUTH_FAIL_PER_MINUTE?.trim() || opts.env.AUTH_FAIL_LIMIT,
  });
  registerAuth(app, { db: opts.db, jwtSecret: opts.env.API_JWT_SECRET });
  // After auth, so the limit is per verified agent or user.
  registerPrincipalLimit();
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
    // No routes: emails the owner or the admins on the events that need them.
    await api.register(notifyPlugin);
  });

  return app;
}

export type App = ReturnType<typeof buildApp>;

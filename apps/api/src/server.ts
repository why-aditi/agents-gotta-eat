// ponytail: Render free has no pre-deploy step, so `start` runs migrations before the server.
// tsx at runtime; switch to a tsup bundle if cold start matters.
import { buildApp, type AppEnv } from "./app";
import { createDb, requireDatabaseUrl } from "./db";
import { startDeadlineSweep } from "./modules/arena";
import { startReauthorizeSweep } from "./modules/escrow";
import { startPaymentJobs } from "./modules/payments";
import { configurePayPal, createPayPalClient } from "./modules/paypal";
import { startPruneSweep } from "./modules/events";
import { aiRanker } from "./modules/judge";
import { llmConfigFromEnv } from "./modules/llm";
import { startExpirySweep } from "./modules/policy";

function envFromProcess(): AppEnv {
  const secret = process.env.API_JWT_SECRET;
  if (!secret) throw new Error("API_JWT_SECRET is not set");
  return {
    API_JWT_SECRET: secret,
    WEB_ORIGINS: process.env.WEB_ORIGINS,
    API_URL: process.env.API_URL,
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
    POLICY_GATE2_STUB: process.env.POLICY_GATE2_STUB,
    GATEWAY_URL: process.env.GATEWAY_URL,
    LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY,
    LLM_DAILY_REQUEST_BUDGET: process.env.LLM_DAILY_REQUEST_BUDGET,
    ALLOW_DEV_CREDIT: process.env.ALLOW_DEV_CREDIT,
    ALLOW_DEV_FUNDING: process.env.ALLOW_DEV_FUNDING,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    AGENTS_WAKE_URL: process.env.AGENTS_WAKE_URL,
    AGENTS_WAKE_SECRET: process.env.AGENTS_WAKE_SECRET,
  };
}

const env = envFromProcess();
const { pool, db } = createDb(requireDatabaseUrl());
const app = buildApp({ db, env });
const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
if (paypalConfigured) {
  configurePayPal(
    createPayPalClient({
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      apiBase: process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com",
      logger: (entry) => app.log.debug({ paypal: entry }, "paypal call"),
    }),
  );
}
let stopSweep: (() => void) | undefined;
let stopDeadlineSweep: (() => void) | undefined;
let stopPaymentJobs: (() => Promise<void>) | undefined;
let stopReauthorizeSweep: (() => void) | undefined;
let stopEvents: (() => void) | undefined;
let stopPrune: (() => void) | undefined;
// Hooks run in order: stop the sweeps before the pool closes.
app.addHook("onClose", async () => {
  stopSweep?.();
  stopDeadlineSweep?.();
  stopReauthorizeSweep?.();
  stopEvents?.();
  stopPrune?.();
  await stopPaymentJobs?.();
});
app.addHook("onClose", () => pool.end());

try {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
  // Releases approvals left pending past their 15 minutes.
  stopSweep = startExpirySweep(db, 60_000, (err) => app.log.error({ err }, "approval expiry sweep failed"));
  // Moves open bounties past their deadline to judging, judges them (the AI judge ranks creative_writing when a
  // gateway is configured) and runs the pick fallback.
  const llm = llmConfigFromEnv(db, env);
  stopDeadlineSweep = startDeadlineSweep(
    db,
    60_000,
    (err, bountyId) => app.log.error({ err, bountyId }, "bounty deadline sweep failed"),
    llm ? { rankCreativeWriting: aiRanker(llm) } : undefined,
  );
  if (paypalConfigured) {
    stopPaymentJobs = await startPaymentJobs(db, requireDatabaseUrl(), (err) => app.log.error({ err }, "payment jobs"));
    // Moves authorizations older than 4 days to a fresh one (allowed once, day 4 to day 29).
    stopReauthorizeSweep = startReauthorizeSweep(db, 60 * 60_000, (err, bountyId) =>
      app.log.error({ err, bountyId }, "escrow reauthorize sweep failed"),
    );
  }
  // Fans new events out to the open SSE streams, polling once a second.
  stopEvents = app.eventBus.start(1000, (err) => app.log.error({ err }, "event poll failed"));
  // Deletes events and agent runs older than 30 days, at startup and then daily.
  stopPrune = startPruneSweep(db, (err) => app.log.error({ err }, "event prune failed"));
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

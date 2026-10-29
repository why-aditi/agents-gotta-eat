// ponytail: Render free has no pre-deploy step, so `start` runs migrations before the server.
// tsx at runtime; switch to a tsup bundle if cold start matters.
import { buildApp, type AppEnv } from "./app";
import { createDb, poolMaxFromEnv, requireDatabaseUrl } from "./db";
import { startDeadlineSweep } from "./modules/arena";
import { startReauthorizeSweep } from "./modules/escrow";
import { startPaymentJobs } from "./modules/payments";
import {
  configurePayPal,
  configurePayPalToolkit,
  createPayPalClient,
  createPayPalToolkit,
  paypalCallLogger,
  recordPayPalCall,
} from "./modules/paypal";
import { startPruneSweep } from "./modules/events";
import { notifyConfigFromEnv, startNotifyJobs } from "./modules/notify";
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
    TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    WEB_URL: process.env.WEB_URL,
    RESEND_API_URL: process.env.RESEND_API_URL,
  };
}

const env = envFromProcess();
const { pool, db } = createDb(requireDatabaseUrl(), { max: poolMaxFromEnv(process.env.DATABASE_POOL_MAX) });
// Demo requests per minute per IP (default 30). The e2e run raises it: every browser there shares one address.
const demoRateLimit = Number.parseInt(process.env.DEMO_RATE_LIMIT ?? "", 10);
const app = buildApp({
  db,
  env,
  demo: Number.isInteger(demoRateLimit) && demoRateLimit > 0 ? { rateLimit: demoRateLimit } : {},
});
const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
if (paypalConfigured) {
  const apiBase = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
  // Every attempt goes to the debug log and to paypal_calls (the admin PayPal tab).
  const logCall = paypalCallLogger(db, (err) => app.log.error({ err }, "paypal call log write failed"));
  const client = createPayPalClient({
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    apiBase,
    logger: async (entry) => {
      app.log.debug({ paypal: entry }, "paypal call");
      await logCall(entry);
    },
  });
  configurePayPal(client);
  // The Agent Toolkit for the Treasurer's reads (sandbox); a loopback fake gets the client's direct calls.
  configurePayPalToolkit(
    createPayPalToolkit({
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      apiBase,
      client,
      record: (call) =>
        recordPayPalCall(db, call).catch((err: unknown) => app.log.error({ err }, "paypal call log write failed")),
    }),
  );
}
let stopSweep: (() => void) | undefined;
let stopDeadlineSweep: (() => void) | undefined;
let stopPaymentJobs: (() => Promise<void>) | undefined;
let stopReauthorizeSweep: (() => void) | undefined;
let stopEvents: (() => void) | undefined;
let stopPrune: (() => void) | undefined;
let stopNotifyJobs: (() => Promise<void>) | undefined;
// Hooks run in order: stop the sweeps before the pool closes.
app.addHook("onClose", async () => {
  stopSweep?.();
  stopDeadlineSweep?.();
  stopReauthorizeSweep?.();
  stopEvents?.();
  stopPrune?.();
  await stopPaymentJobs?.();
  await stopNotifyJobs?.();
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
  // Approval and dispute emails, queued so a Resend hiccup retries. Unset key: the subscriber sends nothing.
  // A queue that fails to start is logged, not fatal: email is a convenience, the dashboard is the record.
  const notify = notifyConfigFromEnv(env);
  if (notify.apiKey) {
    try {
      stopNotifyJobs = await startNotifyJobs(db, requireDatabaseUrl(), notify, (err) =>
        app.log.error({ err }, "notify jobs"),
      );
    } catch (err) {
      app.log.error({ err }, "notify jobs failed to start; emails send inline without retries");
    }
  } else {
    app.log.info("email disabled: RESEND_API_KEY unset");
  }
  // Fans new events out to the open SSE streams (and the email subscriber), polling once a second.
  stopEvents = app.eventBus.start(1000, (err) => app.log.error({ err }, "event poll failed"));
  // Deletes events and agent runs older than 30 days, at startup and then daily.
  stopPrune = startPruneSweep(db, (err) => app.log.error({ err }, "event prune failed"));
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

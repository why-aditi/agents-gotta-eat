// ponytail: Render free has no pre-deploy step, so `start` runs migrations before the server.
// tsx at runtime; switch to a tsup bundle if cold start matters.
import { buildApp, type AppEnv } from "./app";
import { createDb, requireDatabaseUrl } from "./db";
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
    ALLOW_DEV_CREDIT: process.env.ALLOW_DEV_CREDIT,
  };
}

const env = envFromProcess();
const { pool, db } = createDb(requireDatabaseUrl());
const app = buildApp({ db, env });
let stopSweep: (() => void) | undefined;
// Hooks run in order: stop the sweep before the pool closes.
app.addHook("onClose", async () => {
  stopSweep?.();
});
app.addHook("onClose", () => pool.end());

try {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
  // Releases approvals left pending past their 15 minutes.
  stopSweep = startExpirySweep(db, 60_000, (err) => app.log.error({ err }, "approval expiry sweep failed"));
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

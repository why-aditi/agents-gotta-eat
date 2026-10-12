// ponytail: Render free has no pre-deploy step, so `start` runs migrations before the server.
// tsx at runtime; switch to a tsup bundle if cold start matters.
import { buildApp, type AppEnv } from "./app";
import { createDb, requireDatabaseUrl } from "./db";

function envFromProcess(): AppEnv {
  const secret = process.env.API_JWT_SECRET;
  if (!secret) throw new Error("API_JWT_SECRET is not set");
  return {
    API_JWT_SECRET: secret,
    WEB_ORIGINS: process.env.WEB_ORIGINS,
    API_URL: process.env.API_URL,
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
  };
}

const env = envFromProcess();
const { pool, db } = createDb(requireDatabaseUrl());
const app = buildApp({ db, env });
app.addHook("onClose", () => pool.end());

try {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

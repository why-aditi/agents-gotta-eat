// ponytail: Render free has no pre-deploy step, so `start` runs migrations before the server.
// tsx at runtime; switch to a tsup bundle if cold start matters.
import { buildApp } from "./app";

const app = buildApp();

try {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

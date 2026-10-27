// Public demo routes (no auth): GET /v1/demo/stream (SSE replay), /v1/demo/status and
// /v1/demo/recordings/:id/money. Everything here comes from recordings, which hold public events only. Rate
// limited per IP across /v1/demo/*. Also starts the recorder: a bus subscriber that appends public events to the
// active recording.
import type { ServerResponse } from "node:http";
import {
  DemoStatus,
  DemoStreamQuery,
  ErrorBody,
  type MoneyLink,
  MoneyLinks,
  type ReplayEvent,
} from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../http/errors";
import { dailyBudgetFromEnv, requestsToday } from "../llm";
import { RateLimiter } from "./rate-limit";
import { appendLiveEvent, featuredRecording, getRecording, replayEvents } from "./recordings";

export const DEMO_RATE_LIMIT = 30;
// The longest real-time wait between two replayed events, whatever the recorded gap.
export const MAX_GAP_MS = 3_000;
const TAGS = ["demo"];
const PAYPAL_ACTIVITY = "https://www.sandbox.paypal.com/activity/payment/";

export interface DemoRoutesOptions {
  // Requests per minute per IP across /v1/demo/* (default 30).
  rateLimit?: number;
}

// Real-time wait before an event: the recorded gap at this speed, capped.
export function replayWait(offsetMs: number, previousOffsetMs: number, speed: number): number {
  return Math.min(MAX_GAP_MS, Math.max(0, offsetMs - previousOffsetMs) / speed);
}

function sseMessage(e: ReplayEvent): string {
  return `id: ${e.event.id}\nevent: ${e.event.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

// Sandbox links from a recording's bounty events. Orders have no stable sandbox URL, so they carry none.
export function moneyLinks(events: ReplayEvent[]): MoneyLink[] {
  const links: MoneyLink[] = [];
  const seen = new Set<string>();
  const add = (bountyId: string, bountyTitle: string, kind: MoneyLink["kind"], paypalId: string | undefined) => {
    if (!paypalId || seen.has(`${kind}:${paypalId}`)) return;
    seen.add(`${kind}:${paypalId}`);
    links.push({ bountyId, bountyTitle, kind, paypalId, url: kind === "order" ? null : PAYPAL_ACTIVITY + paypalId });
  };
  for (const { event: e } of events) {
    if (e.type === "bounty.opened") {
      add(e.data.bountyId, e.data.title, "order", e.data.paypalOrderId);
      add(e.data.bountyId, e.data.title, "authorization", e.data.authorizationId);
    } else if (e.type === "bounty.settled") {
      add(e.data.bountyId, e.data.title, "capture", e.data.captureId);
    }
  }
  return links;
}

export const demoRoutes: FastifyPluginAsyncZod<DemoRoutesOptions> = async (api, opts) => {
  const limit = opts.rateLimit ?? DEMO_RATE_LIMIT;
  const limiter = new RateLimiter(limit);
  // Encapsulated: only the routes below. Before validation, so a flood of bad requests is limited too.
  api.addHook("onRequest", async (req) => {
    if (!limiter.hit(req.ip)) throw new ApiError("rate_limited", `At most ${limit} demo requests a minute`);
  });

  // The recorder. Appends run one at a time, in delivery order.
  let chain: Promise<unknown> = Promise.resolve();
  const stopRecorder = api.eventBus.subscribe((row) => {
    if (row.scope !== "public") return;
    chain = chain
      .then(() => appendLiveEvent(api.db, row))
      .catch((err: unknown) => api.log.error({ err, eventId: row.id }, "recording append failed"));
  });
  const open = new Set<ServerResponse>();
  api.addHook("preClose", async () => {
    for (const raw of open) raw.end();
  });
  api.addHook("onClose", async () => {
    stopRecorder();
    await chain;
  });

  api.get(
    "/v1/demo/stream",
    {
      config: { auth: "none" },
      schema: {
        tags: TAGS,
        summary: "Replay a recorded run (Server-Sent Events)",
        description:
          "No auth. `text/event-stream`. Replays `recording` (default: the featured one; 404 `not_found` when " +
          "there is none) at `speed` 1 or 4. Each message has `id` (the event's seq), `event` (its type) and " +
          "`data` (a ReplayEvent: `offsetMs` and the ArenaEvent). Events are sent when their time comes: the " +
          "recorded gap divided by `speed`, at most 3 seconds. `from` resumes after that seq. Ends with " +
          "`event: end`. A comment line every 15 seconds is the heartbeat. Rate limited with the other demo routes " +
          "(30 requests a minute per IP, 429 `rate_limited`).",
        querystring: DemoStreamQuery,
        response: { 400: ErrorBody, 404: ErrorBody, 429: ErrorBody },
      },
    },
    async (req, reply) => {
      const { recording, from } = req.query;
      const speed = req.query.speed ?? 1;
      const rec = recording ? await getRecording(api.db, recording) : await featuredRecording(api.db);
      if (!rec) throw new ApiError("not_found", recording ? "Recording not found" : "No recording is featured");
      const all = await replayEvents(api.db, rec);
      const pending = from === undefined ? all : all.filter((e) => e.event.id > from);

      reply.hijack();
      const raw = reply.raw;
      for (const [name, value] of Object.entries(reply.getHeaders()))
        if (value !== undefined) raw.setHeader(name, value);
      raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      raw.write("retry: 2000\n\n");

      let closed = false;
      let timer: NodeJS.Timeout | null = null;
      const heartbeat = setInterval(() => {
        if (!raw.writableEnded) raw.write(": ping\n\n");
      }, api.eventsHeartbeatMs);
      open.add(raw);
      const cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        if (timer) clearTimeout(timer);
        open.delete(raw);
      };
      raw.on("close", cleanup);

      // Resuming starts timing from the next event: it goes out at once.
      let previous = from === undefined ? 0 : (pending[0]?.offsetMs ?? 0);
      let i = 0;
      const next = () => {
        if (closed || raw.writableEnded) return;
        const e = pending[i];
        if (!e) {
          raw.write("event: end\ndata: {}\n\n");
          cleanup();
          raw.end();
          return;
        }
        timer = setTimeout(
          () => {
            if (closed || raw.writableEnded) return;
            raw.write(sseMessage(e));
            previous = e.offsetMs;
            i += 1;
            next();
          },
          replayWait(e.offsetMs, previous, speed),
        );
      };
      next();
    },
  );

  api.get(
    "/v1/demo/status",
    {
      config: { auth: "none" },
      schema: {
        tags: TAGS,
        summary: "The featured recording and whether live mode is near its LLM budget",
        description:
          "No auth. `live.fallback` is true once today's gateway requests reach 80% of the daily budget: the web " +
          "app then sends new visitors to the replay. Rate limited with the other demo routes.",
        response: { 200: DemoStatus, 429: ErrorBody },
      },
    },
    async () => {
      const budget = dailyBudgetFromEnv(api.env);
      const budgetUsed = await requestsToday(api.db, new Date());
      return {
        featured: await featuredRecording(api.db),
        live: { budgetUsed, budget, fallback: budgetUsed * 5 >= budget * 4 },
      };
    },
  );

  api.get(
    "/v1/demo/recordings/:id/money",
    {
      config: { auth: "none" },
      schema: {
        tags: TAGS,
        summary: "PayPal sandbox ids from a recorded run",
        description:
          "No auth. One link per PayPal id on the recording's bounty events: the order and authorization when a " +
          "bounty opened, the capture when it settled. Authorizations and captures link to the sandbox activity " +
          "page; orders have no stable sandbox URL, so `url` is null. Dev-funded bounties have no ids. Payout ids " +
          "are private and never listed. Rate limited with the other demo routes.",
        params: z.object({ id: z.string().min(1).max(64) }),
        response: { 200: MoneyLinks, 400: ErrorBody, 404: ErrorBody, 429: ErrorBody },
      },
    },
    async (req) => {
      const rec = await getRecording(api.db, req.params.id);
      if (!rec) throw new ApiError("not_found", "Recording not found");
      return { links: moneyLinks(await replayEvents(api.db, rec)) };
    },
  );
};

// GET /v1/events (SSE) and POST /v1/agent-runs.
import type { ServerResponse } from "node:http";
import { CreateAgentRunRequest, CreateAgentRunResponse, ErrorBody, EventsQuery } from "@gottaeat/schemas";
import { and, asc, desc, eq, gt, or, type SQL } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../../db";
import { events } from "../../db/schema";
import { requireAgent } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { canSee, type EventRow, toArenaEvent, type Viewer, viewerOf } from "./publish";
import { createAgentRun } from "./runs";

export const MAX_REPLAY = 500;
export const DEFAULT_HEARTBEAT_MS = 15_000;

function visibilitySql(viewer: Viewer): SQL | undefined {
  if (viewer.type === "user" && viewer.admin) return undefined;
  if (viewer.type === "user") return or(eq(events.scope, "public"), eq(events.ownerId, viewer.userId));
  return eq(events.scope, "public");
}

// Events after `afterId` (oldest first, at most 500), or the latest `tail` (returned oldest first).
async function replay(
  db: Db,
  viewer: Viewer,
  bountyId: string | undefined,
  from: { afterId: number } | { tail: number },
): Promise<EventRow[]> {
  const conds: (SQL | undefined)[] = [visibilitySql(viewer), bountyId ? eq(events.bountyId, bountyId) : undefined];
  if ("afterId" in from) {
    return db
      .select()
      .from(events)
      .where(and(...conds, gt(events.id, from.afterId)))
      .orderBy(asc(events.id))
      .limit(MAX_REPLAY);
  }
  const rows = await db
    .select()
    .from(events)
    .where(and(...conds))
    .orderBy(desc(events.id))
    .limit(from.tail);
  return rows.reverse();
}

function parseLastEventId(header: string | string[] | undefined): number | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || !/^\d{1,15}$/.test(value.trim())) return undefined;
  return Number(value.trim());
}

function sseMessage(row: EventRow): string {
  // JSON.stringify escapes newlines, so the data is one line.
  return `id: ${row.id}\nevent: ${row.type}\ndata: ${JSON.stringify(toArenaEvent(row))}\n\n`;
}

export const eventsRoutes: FastifyPluginAsyncZod = async (api) => {
  // Open streams, ended before the server closes (an SSE connection is never idle, so close would wait on it).
  const open = new Set<ServerResponse>();
  api.addHook("preClose", async () => {
    for (const raw of open) raw.end();
  });

  api.get(
    "/v1/events",
    {
      config: { auth: "any" },
      schema: {
        tags: ["events"],
        summary: "Live event stream (Server-Sent Events)",
        description:
          "`text/event-stream`. Each message has `id` (the event id), `event` (its type) and `data` (an ArenaEvent as JSON). " +
          "Agents and users get public events; a user also gets owner events for their own agents (spend.decided, " +
          "approval.decided); admins get every event. `bountyId` narrows the stream to one bounty. On connect the stream " +
          "replays up to 500 events after the `Last-Event-ID` header (or `lastEventId`), or else the latest `tail` " +
          "events (at most 100), then goes live. A comment line is sent every 15 seconds as a heartbeat.",
        querystring: EventsQuery,
        response: { 400: ErrorBody, 401: ErrorBody },
      },
    },
    async (req, reply) => {
      if (!req.principal) throw new ApiError("unauthorized");
      const viewer = viewerOf(req.principal);
      const { bountyId, tail } = req.query;
      const lastId = parseLastEventId(req.headers["last-event-id"]) ?? req.query.lastEventId;
      const bus = api.eventBus;
      await bus.ready();

      const matches = (row: EventRow) => canSee(viewer, row) && (!bountyId || row.bountyId === bountyId);
      reply.hijack();
      const raw = reply.raw;
      // Headers hooks already set (CORS) go out too.
      for (const [name, value] of Object.entries(reply.getHeaders()))
        if (value !== undefined) raw.setHeader(name, value);
      raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      raw.write("retry: 2000\n\n");

      // Live events that arrive during the replay wait in `buffered`, so nothing falls between the two. Rows the
      // poller hasn't reached yet can come live after the replay already sent them (or, with Last-Event-ID, after
      // the client saw them): `skip` drops those.
      let buffered: EventRow[] | null = [];
      let skip: (row: EventRow) => boolean = () => false;
      const send = (row: EventRow) => {
        if (!raw.writableEnded && !skip(row)) raw.write(sseMessage(row));
      };
      const unsubscribe = bus.subscribe((row) => {
        if (!matches(row)) return;
        if (buffered) buffered.push(row);
        else send(row);
      });
      const heartbeat = setInterval(() => {
        if (!raw.writableEnded) raw.write(": ping\n\n");
      }, api.eventsHeartbeatMs);
      open.add(raw);
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        open.delete(raw);
      };
      raw.on("close", cleanup);

      try {
        const from = lastId !== undefined ? { afterId: lastId } : tail ? { tail } : null;
        const replayed = from ? await replay(api.db, viewer, bountyId, from) : [];
        for (const row of replayed) send(row);
        const seen = new Set(replayed.map((r) => r.id));
        // After Last-Event-ID: nothing at or below it. After a tail: nothing older than its newest row.
        const cutoff = lastId ?? replayed.at(-1)?.id ?? 0;
        skip = (row) => seen.has(row.id) || row.id <= cutoff;
        const live = buffered;
        buffered = null;
        for (const row of live) send(row);
      } catch (err) {
        req.log.error({ err }, "event replay failed");
        cleanup();
        raw.end();
      }
    },
  );

  api.post(
    "/v1/agent-runs",
    {
      config: { auth: "agent", idempotent: "optional" },
      schema: {
        tags: ["agent-runs"],
        summary: "Log one step of an agent's run",
        description:
          "Stores the step and publishes a public `agent.run_step` event carrying only the summary (shown in the live " +
          "arena feed, so never put secrets in it). input and output are stored, never shown. At most 60 steps a " +
          "minute per agent (429 `rate_limited`). `Idempotency-Key` is optional. 404 for an unknown or draft bounty.",
        body: CreateAgentRunRequest,
        response: {
          201: CreateAgentRunResponse,
          400: ErrorBody,
          401: ErrorBody,
          403: ErrorBody,
          404: ErrorBody,
          409: ErrorBody,
          422: ErrorBody,
          429: ErrorBody,
        },
      },
    },
    async (req, reply) => {
      const agent = requireAgent(req);
      return reply.code(201).send(await createAgentRun(api.db, agent, req.body));
    },
  );
};

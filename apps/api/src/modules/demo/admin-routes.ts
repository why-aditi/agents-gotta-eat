// Admin demo controls under /v1/admin: record, save a window, feature, delete, reset. Registered inside the admin
// plugin, so its admin check (401, then 403 for non-admins) runs before anything here.
import {
  DemoResetResult,
  ErrorBody,
  Recording,
  RecordingList,
  SaveWindowRequest,
  StartRecordingRequest,
} from "@gottaeat/schemas";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "../../http/auth";
import { ApiError } from "../../http/errors";
import { IDEMPOTENCY_HEADER } from "../../http/idempotency";
import {
  deleteRecording,
  featureRecording,
  listRecordings,
  saveWindow,
  startRecording,
  stopRecording,
} from "./recordings";
import { resetDemo, type ResetOptions } from "./reset";

const TAGS = ["admin"];
const IdParams = z.object({ id: z.string().min(1).max(64) });
const DENIED = { 401: ErrorBody, 403: ErrorBody };

export interface DemoAdminOptions {
  // Tests point the reset at their own seed bounties.
  seedDir?: ResetOptions["seedDir"];
}

export const demoAdminRoutes: FastifyPluginAsyncZod<DemoAdminOptions> = async (api, opts) => {
  api.get(
    "/v1/admin/recordings",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Every recording, newest first",
        description: "Admins only. The active recording (if any) has `endedAt` null.",
        response: { 200: RecordingList, ...DENIED },
      },
    },
    async () => ({ recordings: await listRecordings(api.db) }),
  );

  api.post(
    "/v1/admin/recordings/start",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Start recording public events",
        description:
          "Admins only. Every public event from now until stop is saved with its offset. One recording at a " +
          "time: 409 `recording_active` while one is running. Owner-scoped events are never recorded.",
        body: StartRecordingRequest,
        response: { 201: Recording, 400: ErrorBody, ...DENIED, 409: ErrorBody },
      },
    },
    async (req, reply) => reply.code(201).send(await startRecording(api.db, req.body.title)),
  );

  api.post(
    "/v1/admin/recordings/stop",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Stop the active recording",
        description:
          "Admins only. Also copies any public event in the recording's window that the live recorder missed. " +
          "404 when no recording is active.",
        response: { 200: Recording, ...DENIED, 404: ErrorBody },
      },
    },
    async () => stopRecording(api.db),
  );

  api.post(
    "/v1/admin/recordings/window",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Save a finished recording from events already stored",
        description:
          "Admins only. Copies the public events between `from` and `to` (events are kept 30 days) into a new, " +
          "finished recording.",
        body: SaveWindowRequest,
        response: { 201: Recording, 400: ErrorBody, ...DENIED },
      },
    },
    async (req, reply) => {
      const { title, from, to } = req.body;
      return reply.code(201).send(await saveWindow(api.db, { title, from: new Date(from), to: new Date(to) }));
    },
  );

  api.post(
    "/v1/admin/recordings/:id/feature",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Feature a recording on /demo",
        description: "Admins only. Unfeatures the previous one. 409 `recording_active` for a recording still running.",
        params: IdParams,
        response: { 200: Recording, 400: ErrorBody, ...DENIED, 404: ErrorBody, 409: ErrorBody },
      },
    },
    async (req) => featureRecording(api.db, req.params.id),
  );

  api.delete(
    "/v1/admin/recordings/:id",
    {
      config: { auth: "user" },
      schema: {
        tags: TAGS,
        summary: "Delete a recording and its events",
        description: "Admins only.",
        params: IdParams,
        response: { 204: z.null(), 400: ErrorBody, ...DENIED, 404: ErrorBody },
      },
    },
    async (req, reply) => {
      await deleteRecording(api.db, req.params.id);
      return reply.code(204).send(null);
    },
  );

  api.post(
    "/v1/admin/demo/reset",
    {
      config: { auth: "user", idempotent: true },
      // After the admin check, before validation and idempotency: with the dev flags off this answers 404 like
      // an unknown route and never stores a key.
      onRequest: async () => {
        if (api.env.ALLOW_DEV_FUNDING !== "true" || api.env.ALLOW_DEV_CREDIT !== "true") {
          throw new ApiError("not_found", "Route POST /v1/admin/demo/reset not found");
        }
      },
      schema: {
        tags: TAGS,
        summary: "Reset the demo (dev only)",
        description:
          "Admins only. 404 unless the server runs with `ALLOW_DEV_FUNDING=true` and `ALLOW_DEV_CREDIT=true`. " +
          "Creates and opens (dev funding) each seed bounty that isn't open, and tops the house owner's wallet " +
          "back up to $60 with one dev credit of the difference. Needs an `Idempotency-Key`.",
        response: { 200: DemoResetResult, 400: ErrorBody, ...DENIED, 404: ErrorBody, 409: ErrorBody, 422: ErrorBody },
      },
    },
    async (req) => {
      const admin = requireUser(req);
      return resetDemo(api.db, {
        admin,
        idempotencyKey: String(req.headers[IDEMPOTENCY_HEADER]),
        seedDir: opts.seedDir,
      });
    },
  );
};

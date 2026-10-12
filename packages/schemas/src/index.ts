// This package is the single source of truth for API types.
import { z } from "zod";

export const HealthResponse = z.object({
  ok: z.literal(true),
  service: z.string(),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export * from "./agents";
export * from "./errors";
export * from "./policy";

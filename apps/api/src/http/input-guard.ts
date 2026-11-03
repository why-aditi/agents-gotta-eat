// Central guard for every route (REST and MCP, which calls REST in-process): text Postgres cannot store is a
// 400, not a 500. A NUL character is rejected by Postgres text columns, and lone surrogates are not valid UTF-8.
import { LONE_SURROGATE } from "@gottaeat/schemas";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "./errors";

function badText(s: string): string | null {
  if (s.includes("\u0000")) return "contains a NUL (\\u0000) character";
  if (LONE_SURROGATE.test(s)) return "contains an unpaired surrogate";
  return null;
}

// Returns a JSON pointer and reason for the first bad string (key or value), else null.
export function findBadText(value: unknown, path = ""): { path: string; reason: string } | null {
  if (typeof value === "string") {
    const reason = badText(value);
    return reason ? { path: path || "/", reason } : null;
  }
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = findBadText(v, `${path}/${i}`);
      if (hit) return hit;
    }
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const reason = badText(k);
      if (reason) return { path: `${path}/<key>`, reason: `key ${reason}` };
      const hit = findBadText(v, `${path}/${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

export function registerInputGuard(app: FastifyInstance) {
  app.addHook("preValidation", async (req: FastifyRequest) => {
    for (const [where, value] of [
      ["body", req.body],
      ["query", req.query],
      ["params", req.params],
    ] as const) {
      const hit = findBadText(value);
      if (hit) {
        throw new ApiError("validation_error", `Invalid text in ${where}${hit.path}: ${hit.reason}`, {
          issues: [{ in: where, path: hit.path, code: "invalid_text", message: hit.reason }],
        });
      }
    }
  });
}

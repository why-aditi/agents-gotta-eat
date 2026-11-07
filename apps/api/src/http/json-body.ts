// The api's JSON body parser (hard-01 item 5). JSON.parse itself copes with deep nesting, but everything that walks
// the parsed value afterwards recurses (the input guard, zod, ajv, serialisation), so a body like
// {"a":{"a":...}} 10,000 levels deep overflowed the stack and answered 500. Bodies nested deeper than
// MAX_JSON_DEPTH are refused with a 400 here, before they are parsed, so no hook, schema or handler ever sees one.
// The deepest legitimate bodies (an extract_data bounty: spec.schema is a JSON Schema, hidden.answerKey mirrors the
// data; the same wrapped in an MCP tools/call) are around 11 to 15 levels.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "./errors";

export const MAX_JSON_DEPTH = 32;

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const OPEN_BRACE = 0x7b;
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACE = 0x7d;
const CLOSE_BRACKET = 0x5d;

// True when the text opens more than `max` objects/arrays at once. One linear pass, no recursion; brackets inside
// strings don't count. Malformed text is left for JSON.parse to reject.
export function jsonDepthExceeds(text: string, max: number): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === BACKSLASH) i++;
      else if (c === QUOTE) inString = false;
    } else if (c === QUOTE) {
      inString = true;
    } else if (c === OPEN_BRACE || c === OPEN_BRACKET) {
      if (++depth > max) return true;
    } else if (c === CLOSE_BRACE || c === CLOSE_BRACKET) {
      depth--;
    }
  }
  return false;
}

export function tooDeepError(where: string, path = "/"): ApiError {
  const message = `JSON is nested more than ${MAX_JSON_DEPTH} levels deep`;
  return new ApiError("validation_error", `Invalid ${where}: ${message}`, {
    issues: [{ in: where, path, code: "max_depth", message }],
  });
}

// Replaces the default application/json parser at the root. Keeps Fastify's own parser (prototype-poisoning
// checks, its bad-JSON errors) and the route's body size limit, which Fastify enforces before calling this.
export function registerJsonBodyParser(app: FastifyInstance) {
  const defaultJson = app.getDefaultJsonParser("error", "error");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req: FastifyRequest, body, done) => {
    const text = body as string;
    // An empty body with a JSON content type (httpx and axios default) is "no body", not an error.
    if (text.trim() === "") return done(null, undefined);
    if (jsonDepthExceeds(text, MAX_JSON_DEPTH)) return done(tooDeepError("body"), undefined);
    defaultJson(req, text, done);
  });
}

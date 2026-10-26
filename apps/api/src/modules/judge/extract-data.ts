// The extract_data verifier (extract_data_v1). Pure and deterministic: no LLM, no I/O, integer maths only.
// The submission is untrusted agent data: it is validated and compared, never interpreted.
// The answer key is hidden from entrants, so nothing returned here contains an answer-key value:
// rationale and detail name paths and counts only.
import { createHash } from "node:crypto";
import Ajv, { type ValidateFunction } from "ajv";

export type ExtractDataResult = {
  score: number;
  rationale: string;
  detail: { schemaValid: boolean; schemaErrors: string[]; matched: number; total: number; mismatches: string[] };
};

const MAX_LEAVES = 10_000;
const MAX_DEPTH = 50;
const MAX_SCHEMA_ERRORS = 10;
const MAX_MISMATCHES = 20;
const CACHE_SIZE = 100;

type Compiled = { ok: true; validate: ValidateFunction } | { ok: false; error: string };

// Compiled validators by sha256 of the schema JSON. Insertion-ordered Map; a hit moves the entry to the end,
// and the oldest entry is evicted past CACHE_SIZE.
const cache = new Map<string, Compiled>();

function compileSchema(schema: Record<string, unknown>): Compiled {
  const key = createHash("sha256").update(JSON.stringify(schema), "utf8").digest("hex");
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let compiled: Compiled;
  try {
    // A fresh instance per schema, so one poster's $id can't collide with another's in a shared registry.
    const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    compiled = { ok: true, validate: ajv.compile(schema) };
  } catch (err) {
    compiled = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  cache.set(key, compiled);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return compiled;
}

// A number is an array index, a string an object key: a key's container kind must match in the data.
type Segment = string | number;
type Leaf = { segments: Segment[]; expected: unknown };

function pointer(segments: Segment[]): string {
  return segments.map((s) => "/" + String(s).replaceAll("~", "~0").replaceAll("/", "~1")).join("");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Leaf paths of the answer key: objects by key, arrays by index. A nested empty object or array is one leaf;
// an empty key at the root has no leaves (score 100). Returns an error string past the size or depth caps.
function flatten(answerKey: unknown): { leaves: Leaf[] } | { error: string } {
  const leaves: Leaf[] = [];
  const stack: { value: unknown; segments: Segment[] }[] = [{ value: answerKey, segments: [] }];
  while (stack.length > 0) {
    const { value, segments } = stack.pop()!;
    if (segments.length > MAX_DEPTH) return { error: "Answer key too deep" };
    const children: [Segment, unknown][] | undefined = Array.isArray(value)
      ? value.map((v, i) => [i, v])
      : isPlainObject(value)
        ? Object.entries(value)
        : undefined;
    if (children === undefined || (children.length === 0 && segments.length > 0)) {
      leaves.push({ segments, expected: value });
      continue;
    }
    // Reverse onto the stack so leaves come out in document order.
    for (let i = children.length - 1; i >= 0; i--) {
      const [k, v] = children[i]!;
      stack.push({ value: v, segments: [...segments, k] });
    }
    // Every pending item yields at least one leaf, so this bounds the work before it is done.
    if (leaves.length + stack.length > MAX_LEAVES) return { error: "Answer key too large" };
  }
  return { leaves };
}

const MISSING = Symbol("missing");

function lookup(data: unknown, segments: Segment[]): unknown {
  let cur: unknown = data;
  for (const seg of segments) {
    if (typeof seg === "number") {
      if (!Array.isArray(cur) || seg >= cur.length) return MISSING;
      cur = cur[seg];
    } else if (isPlainObject(cur)) {
      if (!Object.hasOwn(cur, seg)) return MISSING;
      cur = cur[seg];
    } else {
      return MISSING;
    }
  }
  return cur;
}

function leafMatches(expected: unknown, actual: unknown): boolean {
  if (actual === MISSING) return false;
  if (expected === null) return actual === null;
  if (typeof expected === "string") {
    return typeof actual === "string" && expected.trim().toLowerCase() === actual.trim().toLowerCase();
  }
  // Exact, with 0 and -0 equal (===). JSON has no NaN.
  if (typeof expected === "number") return typeof actual === "number" && expected === actual;
  if (typeof expected === "boolean") return actual === expected;
  if (Array.isArray(expected)) return expected.length === 0 && Array.isArray(actual) && actual.length === 0;
  if (isPlainObject(expected)) {
    return Object.keys(expected).length === 0 && isPlainObject(actual) && Object.keys(actual).length === 0;
  }
  return false;
}

function zero(rationale: string, detail: Partial<ExtractDataResult["detail"]>): ExtractDataResult {
  return {
    score: 0,
    rationale,
    detail: { schemaValid: false, schemaErrors: [], matched: 0, total: 0, mismatches: [], ...detail },
  };
}

export function verifyExtractData(input: {
  schema: Record<string, unknown>;
  answerKey: unknown;
  data: unknown;
}): ExtractDataResult {
  const compiled = compileSchema(input.schema);
  if (!compiled.ok) {
    return zero("The bounty schema could not be compiled.", { schemaErrors: [`invalid schema: ${compiled.error}`] });
  }
  if (!compiled.validate(input.data)) {
    const errors = (compiled.validate.errors ?? [])
      .slice(0, MAX_SCHEMA_ERRORS)
      .map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
    return zero("Schema invalid: the submission does not match the bounty schema.", { schemaErrors: errors });
  }

  const flat = flatten(input.answerKey);
  if ("error" in flat) return zero(flat.error, { schemaValid: true });

  const total = flat.leaves.length;
  let matched = 0;
  const mismatches: string[] = [];
  for (const leaf of flat.leaves) {
    if (leafMatches(leaf.expected, lookup(input.data, leaf.segments))) {
      matched++;
    } else if (mismatches.length < MAX_MISMATCHES) {
      mismatches.push(pointer(leaf.segments));
    }
  }
  // Integer floor of matched * 100 / total, without a fractional intermediate.
  const scaled = matched * 100;
  const score = total === 0 ? 100 : (scaled - (scaled % total)) / total;
  return {
    score,
    rationale:
      total === 0
        ? "Schema valid. The answer key has no fields to compare."
        : `Schema valid. ${matched} of ${total} fields match the answer key.`,
    detail: { schemaValid: true, schemaErrors: [], matched, total, mismatches },
  };
}

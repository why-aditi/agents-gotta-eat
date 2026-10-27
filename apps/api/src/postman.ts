// The Postman collection for judges (contract-01), built from the OpenAPI document. Deterministic, so the committed
// file can be checked for staleness: example bodies use placeholders ("<string>", 0, the first enum value), never
// random values. Only a script and a test use this; the api never imports it.
type Json = Record<string, unknown>;
type Schema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  default?: unknown;
  format?: string;
};
interface Parameter {
  in: "path" | "query" | "header";
  name: string;
  required?: boolean;
  description?: string;
  schema?: Schema;
}
interface Operation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  security?: Record<string, string[]>[];
}
export interface OpenApi {
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
}

export const POSTMAN_VARIABLES = [
  { key: "baseUrl", value: "http://localhost:3001" },
  { key: "agentKey", value: "gte_agent_replace_me" },
  { key: "userToken", value: "paste a token from: pnpm --filter @gottaeat/api dev:token --email you@example.com" },
];

const METHODS = ["get", "post", "put", "patch", "delete"];

// A placeholder value for a schema: required properties only, one array item, the first enum or anyOf branch.
function example(schema: Schema | undefined, spec: OpenApi, depth = 0): unknown {
  if (!schema || depth > 8) return null;
  if (schema.$ref) return example(spec.components?.schemas?.[schema.$ref.split("/").pop()!], spec, depth + 1);
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.default !== undefined) return schema.default;
  const branch = schema.anyOf ?? schema.oneOf;
  if (branch?.length) return example(branch.find((b) => b.type !== "null") ?? branch[0], spec, depth + 1);
  if (schema.allOf?.length) return Object.assign({}, ...schema.allOf.map((s) => example(s, spec, depth + 1)));
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  switch (type) {
    case "object": {
      const out: Json = {};
      for (const key of schema.required ?? []) out[key] = example(schema.properties?.[key], spec, depth + 1);
      return out;
    }
    case "array":
      return [example(schema.items, spec, depth + 1)];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "string":
      return schema.format === "date-time" ? "2026-11-11T12:00:00.000Z" : "<string>";
    default:
      return null;
  }
}

function request(method: string, path: string, op: Operation, spec: OpenApi): Json {
  const params = op.parameters ?? [];
  const scheme = Object.keys(op.security?.[0] ?? {})[0];
  const header: Json[] = params
    .filter((p) => p.in === "header")
    .map((p) => ({
      key: p.name,
      value: p.name === "idempotency-key" ? "{{$guid}}" : "<string>",
      ...(p.description ? { description: p.description } : {}),
    }));
  const body = op.requestBody?.content?.["application/json"]?.schema;
  if (body) header.push({ key: "Content-Type", value: "application/json" });
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/^\{(.+)\}$/, ":$1"));
  return {
    method: method.toUpperCase(),
    header,
    auth: scheme
      ? { type: "bearer", bearer: [{ key: "token", value: `{{${scheme}}}`, type: "string" }] }
      : { type: "noauth" },
    ...(body
      ? {
          body: {
            mode: "raw",
            raw: JSON.stringify(example(body, spec), null, 2),
            options: { raw: { language: "json" } },
          },
        }
      : {}),
    url: {
      raw: `{{baseUrl}}/${segments.join("/")}`,
      host: ["{{baseUrl}}"],
      path: segments,
      variable: params.filter((p) => p.in === "path").map((p) => ({ key: p.name, value: `<${p.name}>` })),
      query: params
        .filter((p) => p.in === "query")
        .map((p) => ({ key: p.name, value: String(example(p.schema, spec) ?? ""), disabled: !p.required })),
    },
    ...(op.description ? { description: op.description } : {}),
  };
}

export function buildPostmanCollection(spec: OpenApi): Json {
  const folders = new Map<string, Json[]>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.includes(method)) continue;
      const folder = op.tags?.[0] ?? "other";
      if (!folders.has(folder)) folders.set(folder, []);
      folders
        .get(folder)!
        .push({ name: op.summary ?? `${method.toUpperCase()} ${path}`, request: request(method, path, op, spec) });
    }
  }
  return {
    info: {
      name: spec.info.title,
      description:
        "Generated from /v1/openapi.json by `pnpm postman:export`. Set baseUrl, agentKey (gte_agent_...) and " +
        "userToken. Money-moving POSTs send a fresh Idempotency-Key ({{$guid}}); resend with the same key to replay.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version: spec.info.version,
    },
    item: [...folders].map(([name, item]) => ({ name, item })),
    variable: POSTMAN_VARIABLES,
  };
}

import swagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform, jsonSchemaTransformObject } from "fastify-type-provider-zod";
import pkg from "../../package.json" with { type: "json" };
import type { AuthMode } from "./auth";

const SECURITY: Record<AuthMode, Record<string, string[]>[]> = {
  agent: [{ agentKey: [] }],
  user: [{ userToken: [] }],
  any: [{ agentKey: [] }, { userToken: [] }],
  none: [],
};

// OpenAPI 3.1 built from the routes' zod schemas. No `servers`, so the document is the same in every environment.
export function registerOpenApi(app: FastifyInstance) {
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "Agents Gotta Eat API", version: pkg.version },
      components: {
        securitySchemes: {
          agentKey: { type: "http", scheme: "bearer", description: "Agent API key: gte_agent_..." },
          userToken: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "HS256 token, 10 min max" },
        },
      },
    },
    transform: (doc) => {
      const out = jsonSchemaTransform(doc);
      const auth = doc.route.config?.auth ?? "none";
      const schema: Record<string, unknown> = { ...out.schema, security: SECURITY[auth] };
      // Money-moving POSTs need an Idempotency-Key (http/idempotency.ts); document it as a header parameter.
      const idem = doc.route.config?.idempotent;
      if (idem) {
        const headers = (schema.headers ?? {}) as { type?: string; properties?: object; required?: string[] };
        schema.headers = {
          type: "object",
          ...headers,
          properties: {
            ...headers.properties,
            "idempotency-key": {
              type: "string",
              minLength: 1,
              maxLength: 255,
              description: "Printable ASCII. A retry with the same key and body replays the first response.",
            },
          },
          required: idem === "optional" ? (headers.required ?? []) : [...(headers.required ?? []), "idempotency-key"],
        };
      }
      return { ...out, schema };
    },
    transformObject: jsonSchemaTransformObject,
  });
}

export function registerOpenApiRoute(app: FastifyInstance) {
  app.get("/v1/openapi.json", { config: { auth: "none" } }, async () => app.swagger());
}

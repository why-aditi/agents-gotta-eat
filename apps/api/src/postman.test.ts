// The committed Postman collection matches the committed OpenAPI document (run `pnpm postman:export` after
// `pnpm openapi:export`), and its requests are usable as they stand.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPostmanCollection, type OpenApi } from "./postman";

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const spec = read("../../../packages/schemas/openapi.json") as OpenApi;
const committed = read("../../../docs/postman/gottaeat.postman_collection.json");

type Item = { name: string; request: { method: string; header: { key: string; value: string }[]; auth: unknown } };
const requests = (c: { item: { item: Item[] }[] }) => c.item.flatMap((f) => f.item);

describe("Postman collection", () => {
  it("is up to date with openapi.json (run `pnpm postman:export`)", () => {
    expect(committed).toEqual(buildPostmanCollection(spec));
  });

  it("has one request per operation, and each Idempotency-Key is a fresh guid", () => {
    const ops = Object.values(spec.paths).flatMap((item) =>
      Object.keys(item).filter((m) => ["get", "post", "put", "patch", "delete"].includes(m)),
    );
    const items = requests(committed);
    expect(items).toHaveLength(ops.length);
    const keyed = items.filter((i) => i.request.header.some((h) => h.key === "idempotency-key"));
    expect(keyed.length).toBeGreaterThanOrEqual(18);
    for (const i of keyed) {
      expect(i.request.header.find((h) => h.key === "idempotency-key")?.value, i.name).toBe("{{$guid}}");
    }
  });

  it("uses the agent key or user token variable the operation's security names", () => {
    const spend = requests(committed).find((i) => i.name === "Ask to spend from the owner's wallet");
    expect(spend?.request.auth).toMatchObject({ type: "bearer", bearer: [{ value: "{{agentKey}}" }] });
    expect(JSON.stringify(committed)).not.toMatch(/gte_agent_[A-Za-z0-9_-]{20,}/);
  });
});

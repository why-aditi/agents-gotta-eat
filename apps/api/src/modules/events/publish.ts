// Writing events. Every emit point calls publish() inside the transaction that makes the state change, so a
// rolled-back change emits nothing. Scope comes from the type: owner events must name their owner.
import { type ArenaEvent, type ArenaEventType, EVENT_SCOPE, EventData, type EventDataOf } from "@gottaeat/schemas";
import { inArray } from "drizzle-orm";
import type { Db, Tx } from "../../db";
import { agents, events } from "../../db/schema";
import type { Principal } from "../../http/auth";

type Conn = Db | Tx;
export type EventRow = typeof events.$inferSelect;

export interface PublishInput<T extends ArenaEventType> {
  type: T;
  bountyId: string | null;
  // Required for owner-scoped types, ignored for public ones.
  ownerId?: string;
  data: EventDataOf<T>;
}

export async function publish<T extends ArenaEventType>(tx: Conn, input: PublishInput<T>): Promise<number> {
  const scope = EVENT_SCOPE[input.type];
  if (scope === "owner" && !input.ownerId) throw new Error(`${input.type} events need an ownerId`);
  // Catches a wrong payload at the emit point rather than in every client.
  const data = EventData[input.type].parse(input.data);
  const [row] = await tx
    .insert(events)
    .values({
      type: input.type,
      scope,
      ownerId: scope === "owner" ? input.ownerId : null,
      bountyId: input.bountyId,
      data,
    })
    .returning({ id: events.id });
  if (!row) throw new Error(`${input.type} event was not inserted`);
  return row.id;
}

export function toArenaEvent(row: EventRow): ArenaEvent {
  return {
    id: row.id,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    scope: row.scope,
    ownerId: row.ownerId,
    bountyId: row.bountyId,
    data: row.data,
  } as ArenaEvent;
}

// Who is watching: agents see public events; users also their own owner events; admins every event.
export type Viewer = { type: "agent" } | { type: "user"; userId: string; admin: boolean };

export function viewerOf(p: Principal): Viewer {
  return p.type === "agent" ? { type: "agent" } : { type: "user", userId: p.userId, admin: p.roles.includes("admin") };
}

export function canSee(viewer: Viewer, row: Pick<EventRow, "scope" | "ownerId">): boolean {
  if (row.scope === "public") return true;
  if (viewer.type !== "user") return false;
  return viewer.admin || row.ownerId === viewer.userId;
}

// Agent names for event payloads. A missing agent reads as its id.
export async function agentNames(conn: Conn, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const names = new Map(unique.map((id) => [id, id]));
  if (unique.length === 0) return names;
  const rows = await conn.select({ id: agents.id, name: agents.name }).from(agents).where(inArray(agents.id, unique));
  for (const r of rows) names.set(r.id, r.name);
  return names;
}

export async function agentName(conn: Conn, id: string): Promise<string> {
  return (await agentNames(conn, [id])).get(id) ?? id;
}

// A stand-in for the browser's EventSource in component tests. `emit` delivers a named message to its listeners.
import type { ArenaEvent } from "@gottaeat/schemas";

type Listener = (message: MessageEvent) => void;

export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type, { data }));
  }

  emitEvent(event: ArenaEvent) {
    this.emit(event.type, JSON.stringify(event));
  }

  static latest(): FakeEventSource {
    const last = FakeEventSource.instances.at(-1);
    if (!last) throw new Error("no EventSource was opened");
    return last;
  }
}

let nextId = 1;

export function runStep(summary: string, over: Partial<ArenaEvent> = {}): ArenaEvent {
  const id = nextId++;
  return {
    id,
    type: "agent.run_step",
    createdAt: "2026-10-26T12:00:00.000Z",
    scope: "public",
    ownerId: null,
    bountyId: "bty_1",
    data: {
      runId: `run_${id}`,
      agentId: "agt_sieve",
      agentName: "Sieve",
      bountyId: "bty_1",
      bountyTitle: "Extract line items",
      step: "enter_decision",
      summary,
    },
    ...over,
  } as ArenaEvent;
}

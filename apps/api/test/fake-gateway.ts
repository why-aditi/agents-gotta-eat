// A fake OpenAI-compatible gateway (the LiteLLM proxy's /v1/chat/completions) for tests. Responses come from a
// queue of canned replies; every request is recorded. An empty queue answers 503.
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type CannedReply =
  // A completion whose message content is JSON.stringify(json).
  | { json: unknown; delayMs?: number; model?: string }
  // A completion with this exact content (e.g. malformed JSON).
  | { content: string; delayMs?: number; model?: string }
  // A tool-call turn (OpenAI format): the model asks for these tools, with optional content.
  | { toolCalls: { name: string; arguments: unknown; id?: string }[]; content?: string | null; delayMs?: number }
  // A bare HTTP error.
  | { status: number; body?: string; delayMs?: number };

export interface RecordedRequest {
  headers: IncomingHttpHeaders;
  body: {
    model: string;
    messages: {
      role: string;
      content: string;
      tool_calls?: { id: string; function: { name: string; arguments: string } }[];
      tool_call_id?: string;
    }[];
    temperature?: number;
    response_format?: unknown;
    tools?: { function: { name: string } }[];
    tool_choice?: unknown;
  };
}

export interface FakeGateway {
  url: string;
  requests: RecordedRequest[];
  enqueue: (...replies: CannedReply[]) => void;
  reset: () => void;
  close: () => Promise<void>;
}

export async function startFakeGateway(): Promise<FakeGateway> {
  const queue: CannedReply[] = [];
  const requests: RecordedRequest[] = [];
  const timers = new Set<NodeJS.Timeout>();

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      let body: RecordedRequest["body"];
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as RecordedRequest["body"];
      } catch {
        res.writeHead(400).end("bad json");
        return;
      }
      requests.push({ headers: req.headers, body });
      const reply = queue.shift();
      const send = () => {
        if (res.destroyed) return;
        if (!reply) {
          res.writeHead(503, { "content-type": "text/plain" }).end("no canned reply");
          return;
        }
        if ("status" in reply) {
          res.writeHead(reply.status, { "content-type": "text/plain" }).end(reply.body ?? "error");
          return;
        }
        const n = requests.length;
        const message =
          "toolCalls" in reply
            ? {
                role: "assistant",
                content: reply.content ?? null,
                tool_calls: reply.toolCalls.map((c, i) => ({
                  id: c.id ?? `call_${n}_${i}`,
                  type: "function",
                  function: {
                    name: c.name,
                    arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments),
                  },
                })),
              }
            : { role: "assistant", content: "json" in reply ? JSON.stringify(reply.json) : reply.content };
        res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            id: `chatcmpl-${n}`,
            object: "chat.completion",
            model: ("model" in reply ? reply.model : undefined) ?? `served-${body.model}`,
            choices: [{ index: 0, message, finish_reason: "toolCalls" in reply ? "tool_calls" : "stop" }],
            usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
          }),
        );
      };
      if (reply?.delayMs) {
        const t = setTimeout(() => {
          timers.delete(t);
          send();
        }, reply.delayMs);
        timers.add(t);
      } else {
        send();
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    enqueue: (...replies) => queue.push(...replies),
    reset: () => {
      queue.length = 0;
      requests.length = 0;
    },
    close: async () => {
      for (const t of timers) clearTimeout(t);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

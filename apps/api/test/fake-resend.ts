// A fake Resend API (POST /emails) for tests. Every request is recorded; `status` sets the next answers (default
// 200 with an id).
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface ResendRequest {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: { from: string; to: string[]; subject: string; html: string; text: string };
}

export interface FakeResend {
  url: string;
  requests: ResendRequest[];
  // Status codes for the next requests, in order; then 200.
  failNext: (...statuses: number[]) => void;
  close: () => Promise<void>;
}

export async function startFakeResend(): Promise<FakeResend> {
  const requests: ResendRequest[] = [];
  const statuses: number[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: (raw ? JSON.parse(raw) : {}) as ResendRequest["body"],
      });
      const status = statuses.shift() ?? 200;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(status < 300 ? { id: `email_${requests.length}` } : { message: "nope" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    failNext: (...s) => statuses.push(...s),
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

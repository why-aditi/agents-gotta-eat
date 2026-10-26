// A dependency-free fake of the PayPal REST endpoints the api calls, for `pnpm e2e` only. It keeps orders,
// authorizations and payouts in memory, records every call and honours PayPal-Request-Id (same id, same answer).
//   GET /__calls[?path=substr]  recorded calls, oldest first      POST /__reset  forget everything
//   GET /health                 liveness for Playwright
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT ?? 4010);
const DAY_MS = 86_400_000;

let calls = [];
let orders = new Map();
let auths = new Map();
let payouts = new Map();
let replies = new Map();

const id = (n = 9) => randomBytes(n).toString("hex").slice(0, n).toUpperCase();

function reset() {
  calls = [];
  orders = new Map();
  auths = new Map();
  payouts = new Map();
  replies = new Map();
}

function orderView(o) {
  const payments = {};
  if (o.auth) payments.authorizations = [o.auth];
  if (o.capture) payments.captures = [o.capture];
  return {
    id: o.id,
    intent: o.intent,
    status: o.status,
    purchase_units: [{ custom_id: o.customId, amount: o.amount, ...(o.auth || o.capture ? { payments } : {}) }],
  };
}

function batchView(b) {
  return {
    batch_header: { payout_batch_id: b.id, batch_status: b.status, sender_batch_header: b.header },
    items: b.items.map((i) => ({
      payout_item_id: i.payoutItemId,
      transaction_status: i.status,
      payout_item: { sender_item_id: i.senderItemId, amount: i.amount, receiver: i.receiver },
    })),
  };
}

const notFound = (what) => [
  404,
  { name: "RESOURCE_NOT_FOUND", message: `${what} not found`, details: [{ issue: "INVALID_RESOURCE_ID" }] },
];

// Returns [status, body|null]. `body` is the parsed JSON request body.
function handle(method, path, body) {
  if (method === "POST" && path === "/v1/oauth2/token") {
    return [200, { access_token: `fake-token-${id(6)}`, token_type: "Bearer", expires_in: 32400 }];
  }
  if (method === "POST" && path === "/v2/checkout/orders") {
    const unit = body?.purchase_units?.[0] ?? {};
    const order = { id: id(9), intent: body?.intent, status: "CREATED", customId: unit.custom_id, amount: unit.amount };
    orders.set(order.id, order);
    return [201, orderView(order)];
  }
  let m = /^\/v2\/checkout\/orders\/([^/]+)(?:\/(authorize|capture))?$/.exec(path);
  if (m) {
    const order = orders.get(m[1]);
    if (!order) return notFound("order");
    if (method === "GET" && !m[2]) return [200, orderView(order)];
    if (method === "POST" && m[2] === "authorize") {
      order.auth = {
        id: id(9),
        status: "CREATED",
        amount: order.amount,
        custom_id: order.customId,
        expiration_time: new Date(Date.now() + 29 * DAY_MS).toISOString(),
      };
      order.status = "COMPLETED";
      auths.set(order.auth.id, { ...order.auth, orderId: order.id, state: "CREATED" });
      return [201, orderView(order)];
    }
    if (method === "POST" && m[2] === "capture") {
      order.capture = { id: id(9), status: "COMPLETED", amount: order.amount, custom_id: order.customId };
      order.status = "COMPLETED";
      return [201, orderView(order)];
    }
  }
  m = /^\/v2\/payments\/authorizations\/([^/]+)\/(capture|void|reauthorize)$/.exec(path);
  if (method === "POST" && m) {
    const auth = auths.get(m[1]);
    if (!auth) return notFound("authorization");
    if (m[2] === "void") {
      auth.state = "VOIDED";
      return [204, null];
    }
    if (m[2] === "capture") {
      auth.state = "CAPTURED";
      return [201, { id: id(9), status: "COMPLETED", amount: body?.amount ?? auth.amount, final_capture: true }];
    }
    auth.expiration_time = new Date(Date.now() + 29 * DAY_MS).toISOString();
    return [201, { id: auth.id, status: "CREATED", amount: auth.amount, expiration_time: auth.expiration_time }];
  }
  if (method === "POST" && path === "/v1/payments/payouts") {
    const batch = {
      id: `FAKEBATCH${id(6)}`,
      status: "PENDING",
      header: body?.sender_batch_header ?? {},
      items: (body?.items ?? []).map((i) => ({
        payoutItemId: id(8),
        status: "PENDING",
        senderItemId: i.sender_item_id,
        amount: i.amount,
        receiver: i.receiver,
      })),
    };
    payouts.set(batch.id, batch);
    return [201, batchView(batch)];
  }
  m = /^\/v1\/payments\/payouts\/([^/]+)$/.exec(path);
  if (method === "GET" && m) {
    const batch = payouts.get(m[1]);
    return batch ? [200, batchView(batch)] : notFound("payout batch");
  }
  if (method === "POST" && path === "/v1/notifications/verify-webhook-signature") {
    const bad = String(body?.webhook_event?.id ?? "").startsWith("BAD-");
    return [200, { verification_status: bad ? "FAILURE" : "SUCCESS" }];
  }
  return [404, { name: "NOT_FOUND", message: `no fake for ${method} ${path}`, details: [{ issue: "NOT_FOUND" }] }];
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://fake");
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json", "paypal-debug-id": id(6).toLowerCase() });
      res.end(body === null ? undefined : JSON.stringify(body));
    };
    const { pathname } = url;
    if (pathname === "/health") return send(200, { ok: true });
    if (pathname === "/__reset" && req.method === "POST") {
      reset();
      return send(200, { ok: true });
    }
    if (pathname === "/__calls" && req.method === "GET") {
      const filter = url.searchParams.get("path");
      return send(200, filter ? calls.filter((c) => c.path.includes(filter)) : calls);
    }

    // The real API answers 415 to a POST without a JSON content type, even when the body is empty.
    if (
      req.method === "POST" &&
      pathname !== "/v1/oauth2/token" &&
      !String(req.headers["content-type"] ?? "").includes("json")
    ) {
      return send(415, {
        name: "UNSUPPORTED_MEDIA_TYPE",
        message: "The request payload is not supported",
        details: [{ issue: "UNSUPPORTED_MEDIA_TYPE" }],
      });
    }

    const raw = Buffer.concat(chunks).toString("utf8");
    let body;
    if (raw) {
      try {
        body = String(req.headers["content-type"] ?? "").includes("json") ? JSON.parse(raw) : raw;
      } catch {
        body = raw;
      }
    }
    const requestId = req.headers["paypal-request-id"];
    const key = requestId && pathname !== "/v1/oauth2/token" ? `${req.method} ${pathname} ${requestId}` : null;
    const replay = key ? replies.get(key) : undefined;
    const [status, reply] = replay ?? handle(req.method ?? "GET", pathname, body);
    if (key && !replay) replies.set(key, [status, reply]);
    const headers = { ...req.headers };
    delete headers.authorization; // never record credentials
    calls.push({
      at: new Date().toISOString(),
      method: req.method,
      path: pathname,
      headers,
      body,
      status,
      replayed: Boolean(replay),
    });
    send(status, reply);
  });
}).listen(PORT, () => console.log(`fake PayPal listening on :${PORT}`));

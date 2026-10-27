// A dependency-free fake of the PayPal REST endpoints the api calls, for `pnpm e2e` only. It keeps orders,
// authorizations, captures, refunds and payouts in memory, records every call and honours PayPal-Request-Id (same id, same
// answer). The transaction search (/v1/reporting/transactions) is built from the captures and payout items it has
// seen, so a PayPal reconciliation against it can come out clean.
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
let captures = new Map();
let replies = new Map();

const id = (n = 9) => randomBytes(n).toString("hex").slice(0, n).toUpperCase();

function reset() {
  calls = [];
  orders = new Map();
  auths = new Map();
  payouts = new Map();
  captures = new Map();
  replies = new Map();
}

// A capture as GET /v2/payments/captures/:id answers it, remembered for the transaction search.
function recordCapture(capture, customId, orderId) {
  captures.set(capture.id, { ...capture, custom_id: customId, orderId, at: new Date().toISOString() });
}

// PayPal's reporting dates look like 2026-10-27T10:00:00+0000.
const reportingDate = (iso) => iso.replace(/\.\d{3}Z$/, "+0000");

function transactionSearch(query) {
  const start = Date.parse(query.get("start_date") ?? "") || 0;
  const end = Date.parse(query.get("end_date") ?? "") || Date.now() + 60_000;
  const status = query.get("transaction_status");
  const rows = [];
  for (const c of captures.values()) {
    rows.push({
      at: c.at,
      info: {
        transaction_id: c.id,
        transaction_event_code: "T0006",
        transaction_status: "S",
        transaction_amount: { currency_code: "USD", value: c.amount.value },
        custom_field: c.custom_id,
      },
    });
    for (const r of c.refunds ?? []) {
      rows.push({
        at: r.at,
        info: {
          transaction_id: r.id,
          paypal_reference_id: c.id,
          transaction_event_code: "T1107",
          transaction_status: "S",
          transaction_amount: { currency_code: "USD", value: `-${r.amount.value}` },
          custom_field: c.custom_id,
        },
      });
    }
  }
  // Payout items stay PENDING in this fake, so a search for successful transactions (S) leaves them out.
  for (const b of payouts.values()) {
    for (const i of b.items) {
      rows.push({
        at: b.at,
        info: {
          transaction_id: i.payoutItemId,
          paypal_reference_id: b.id,
          transaction_event_code: "T0000",
          transaction_status: i.status === "SUCCESS" ? "S" : "P",
          transaction_amount: { currency_code: "USD", value: `-${i.amount.value}` },
        },
      });
    }
  }
  const details = rows
    .filter((r) => Date.parse(r.at) >= start && Date.parse(r.at) <= end)
    .filter((r) => !status || r.info.transaction_status === status)
    .map((r) => ({ transaction_info: { ...r.info, transaction_initiation_date: reportingDate(r.at) } }));
  return { transaction_details: details, account_number: "FAKE", page: 1, total_items: details.length, total_pages: 1 };
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

// Returns [status, body|null]. `body` is the parsed JSON request body; `query` the URLSearchParams.
function handle(method, path, body, query) {
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
      recordCapture(order.capture, order.customId, order.id);
      return [201, orderView(order)];
    }
  }
  m = /^\/v2\/payments\/(captures|authorizations)\/([^/]+)$/.exec(path);
  if (method === "GET" && m) {
    if (m[1] === "captures") {
      const c = captures.get(m[2]);
      if (!c) return notFound("capture");
      return [
        200,
        {
          id: c.id,
          status: c.status,
          amount: c.amount,
          custom_id: c.custom_id,
          create_time: c.at,
          update_time: c.at,
          supplementary_data: { related_ids: { order_id: c.orderId } },
        },
      ];
    }
    const auth = auths.get(m[2]);
    if (!auth) return notFound("authorization");
    const { id: authId, state, amount, custom_id, expiration_time } = auth;
    return [200, { id: authId, status: state, amount, custom_id, expiration_time }];
  }
  if (method === "GET" && path === "/v1/reporting/transactions") return [200, transactionSearch(query)];
  // A (partial) refund of a capture: the api refunds the reward of an overturned dispute (disp-01).
  m = /^\/v2\/payments\/captures\/([^/]+)\/refund$/.exec(path);
  if (method === "POST" && m) {
    const c = captures.get(m[1]);
    if (!c) return notFound("capture");
    const amount = body?.amount ?? c.amount;
    c.refunds = [...(c.refunds ?? []), { id: `REFUND-${id(9)}`, amount, at: new Date().toISOString() }];
    const refund = c.refunds.at(-1);
    return [
      201,
      { id: refund.id, status: "COMPLETED", amount, links: [{ rel: "up", href: `/v2/payments/captures/${c.id}` }] },
    ];
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
      const capture = { id: id(9), status: "COMPLETED", amount: body?.amount ?? auth.amount, final_capture: true };
      recordCapture(capture, auth.custom_id, auth.orderId);
      return [201, capture];
    }
    auth.expiration_time = new Date(Date.now() + 29 * DAY_MS).toISOString();
    return [201, { id: auth.id, status: "CREATED", amount: auth.amount, expiration_time: auth.expiration_time }];
  }
  if (method === "POST" && path === "/v1/payments/payouts") {
    const batch = {
      id: `FAKEBATCH${id(6)}`,
      at: new Date().toISOString(),
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
  m = /^\/v1\/payments\/payouts-item\/([^/]+)$/.exec(path);
  if (method === "GET" && m) {
    for (const b of payouts.values()) {
      const i = b.items.find((x) => x.payoutItemId === m[1]);
      if (i) {
        return [
          200,
          {
            payout_item_id: i.payoutItemId,
            transaction_id: i.payoutItemId,
            transaction_status: i.status,
            payout_batch_id: b.id,
            payout_item: { sender_item_id: i.senderItemId, amount: i.amount, receiver: i.receiver },
          },
        ];
      }
    }
    return notFound("payout item");
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
    const [status, reply] = replay ?? handle(req.method ?? "GET", pathname, body, url.searchParams);
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

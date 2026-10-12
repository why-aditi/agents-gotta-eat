// Shared helpers for the PayPal sandbox spike. Throwaway code: see docs/tasks/paypal-spike.md.
// Money is integer cents (bigint). Every PayPal call sends a fresh PayPal-Request-Id.
// The Authorization header and the client secret are never logged or written to disk.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const TOKEN_SKEW_MS = 60_000;

// ---------- money ----------

/** Integer cents to PayPal's decimal string ("55.00"). Integer math only. */
export function formatCents(cents: bigint): string {
  if (cents < 0n) throw new Error(`formatCents: negative amount ${cents}`);
  const whole = cents / 100n;
  const frac = cents % 100n;
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

/** Parses a CLI cents value ("5500") into a bigint. Digits only, no decimals or signs. */
export function parseCents(raw: string): bigint {
  if (!/^\d+$/.test(raw)) throw new Error(`--cents must be a non-negative integer number of cents, got "${raw}"`);
  return BigInt(raw);
}

// ---------- env and paths ----------

/** Read at call time so tests can change it. Refuses anything that is not sandbox. */
export function apiBase(): string {
  const base = (process.env.PAYPAL_API_BASE ?? "").trim() || SANDBOX_BASE;
  if (!base.includes("sandbox")) throw new Error(`PAYPAL_API_BASE must be a sandbox URL, got ${base}`);
  return base.replace(/\/+$/, "");
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}. Fill it in the repo-root .env (see .env.example).`);
  return value;
}

let outDirOverride: string | undefined;

/** Directory for state.json and request logs. Defaults to spikes/paypal/out. */
export function outDir(): string {
  return outDirOverride ?? resolve(import.meta.dirname, "..", "out");
}

/** Test hook: point logs and state at another directory (undefined restores the default). */
export function setOutDir(dir: string | undefined): void {
  outDirOverride = dir;
}

function ensureOutDir(): string {
  const dir = outDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Writes `out/<iso-ts>-<name>.json` and returns its path. */
export function saveLog(name: string, data: unknown): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = name.replace(/[^A-Za-z0-9_-]/g, "_");
  const file = join(ensureOutDir(), `${ts}-${safeName}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return file;
}

// ---------- auth ----------

interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | undefined;

export function resetTokenCache(): void {
  tokenCache = undefined;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** OAuth2 client-credentials token, cached until shortly before expiry. Never logged. */
export async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const clientId = requireEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requireEnv("PAYPAL_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "PayPal-Request-Id": randomUUID(),
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    // Only the error fields, never the request headers.
    throw new Error(`Token request failed (${res.status}): ${json.error ?? ""} ${json.error_description ?? ""}`.trim());
  }
  const ttlMs = (json.expires_in ?? 0) * 1000;
  tokenCache = { token: json.access_token, expiresAt: Date.now() + Math.max(0, ttlMs - TOKEN_SKEW_MS) };
  return json.access_token;
}

// ---------- PayPal REST ----------

export interface PayPalResponse<T = unknown> {
  ok: boolean;
  status: number;
  requestId: string;
  debugId: string | null;
  /** Parsed JSON body (success or PayPal error body), raw text if not JSON, null if empty. */
  body: T;
  logFile: string;
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key.toLowerCase() !== "authorization") out[key] = value;
  });
  return out;
}

/**
 * One PayPal REST call. Sends Bearer auth, a fresh PayPal-Request-Id and a JSON body.
 * Does not throw on 4xx/5xx: returns the parsed error body so scripts can print and log it.
 * Request and response are saved to out/<iso-ts>-<name>.json without the Authorization header.
 */
export async function paypal<T = unknown>(
  method: HttpMethod,
  path: string,
  body: unknown,
  name: string,
): Promise<PayPalResponse<T>> {
  const token = await getToken();
  const url = `${apiBase()}${path}`;
  const requestId = randomUUID();
  const loggedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Prefer: "return=representation",
    "PayPal-Request-Id": requestId,
  };
  const init: RequestInit = {
    method,
    headers: { ...loggedHeaders, Authorization: `Bearer ${token}` },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let status = 0;
  let parsed: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let networkError: string | undefined;
  try {
    const res = await fetch(url, init);
    status = res.status;
    responseHeaders = headersToObject(res.headers);
    const text = await res.text();
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
  } catch (err) {
    networkError = err instanceof Error ? err.message : String(err);
  }

  const debugId = responseHeaders["paypal-debug-id"] ?? null;
  const logFile = saveLog(name, {
    request: { method, url, headers: loggedHeaders, body: body ?? null },
    response: networkError ? { error: networkError } : { status, headers: responseHeaders, body: parsed },
  });
  if (networkError) throw new Error(`${method} ${path} failed: ${networkError} (logged to ${logFile})`);

  return { ok: status >= 200 && status < 300, status, requestId, debugId, body: parsed as T, logFile };
}

/** Prints a short result line plus the body; sets a failing exit code on non-2xx. */
export function report(label: string, res: PayPalResponse): void {
  const tag = res.ok ? "OK" : "FAILED";
  console.log(`${tag} ${label}: HTTP ${res.status} (debug id ${res.debugId ?? "n/a"})`);
  console.log(`  log: ${res.logFile}`);
  if (!res.ok) {
    console.log(JSON.stringify(res.body, null, 2));
    process.exitCode = 1;
  }
}

// ---------- state ----------

export interface AuthorizationRecord {
  id: string;
  status?: string;
  expirationTime?: string;
  createTime?: string;
  /** Any field whose name mentions "honor", copied as-is. */
  honorFields?: Record<string, unknown>;
  recordedAt: string;
  /** Why this record left "current": e.g. "reauthorized". */
  replacedBy?: string;
}

export interface LabelState {
  orderId: string;
  intent: "AUTHORIZE" | "CAPTURE";
  /** Cents as a decimal string (JSON has no bigint). */
  cents: string;
  approveUrl?: string;
  authorization?: AuthorizationRecord;
  authorizationHistory: AuthorizationRecord[];
  captureId?: string;
  voided?: boolean;
}

export interface SpikeState {
  labels: Record<string, LabelState>;
  payoutBatches: string[];
}

function statePath(): string {
  return join(outDir(), "state.json");
}

export function loadState(): SpikeState {
  const file = statePath();
  if (!existsSync(file)) return { labels: {}, payoutBatches: [] };
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<SpikeState>;
  return { labels: raw.labels ?? {}, payoutBatches: raw.payoutBatches ?? [] };
}

export function saveState(state: SpikeState): void {
  ensureOutDir();
  writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n");
}

export function requireLabel(state: SpikeState, label: string): LabelState {
  const entry = state.labels[label];
  if (!entry)
    throw new Error(`No state for label "${label}". Run: pnpm order --intent AUTHORIZE --cents 5500 --label ${label}`);
  return entry;
}

// ---------- CLI ----------

/** Reads `--name value` or `--name=value` from argv. */
export function arg(name: string, argv: readonly string[] = process.argv.slice(2)): string | undefined {
  const flag = `--${name}`;
  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    if (current === flag) {
      const next = argv[i + 1];
      return next !== undefined && !next.startsWith("--") ? next : undefined;
    }
    if (current?.startsWith(`${flag}=`)) return current.slice(flag.length + 1);
  }
  return undefined;
}

export function requireArg(name: string, argv?: readonly string[]): string {
  const value = arg(name, argv);
  if (value === undefined || value === "") throw new Error(`Missing --${name}`);
  return value;
}

/** Runs a script body, printing errors (never secrets) and setting exit code 1. */
export function main(fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

/** Finds a HATEOAS link by rel. */
export function findLink(links: readonly Link[] | undefined, ...rels: string[]): string | undefined {
  return links?.find((l) => l.rel !== undefined && rels.includes(l.rel))?.href;
}

/** Copies any key mentioning "honor" (case-insensitive) from an object, recursively. */
export function pickHonorFields(obj: unknown, prefix = ""): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  if (obj === null || typeof obj !== "object") return found;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (/honor/i.test(key)) found[path] = value;
    else if (value !== null && typeof value === "object") Object.assign(found, pickHonorFields(value, path));
  }
  return found;
}

// ---------- PayPal response shapes (only the fields the spike reads) ----------

export interface Link {
  rel?: string;
  href?: string;
}

export interface PayPalAuthorization {
  id?: string;
  status?: string;
  expiration_time?: string;
  create_time?: string;
  [key: string]: unknown;
}

export function toAuthRecord(auth: PayPalAuthorization & { id: string }): AuthorizationRecord {
  const honor = pickHonorFields(auth);
  return {
    id: auth.id,
    status: auth.status,
    expirationTime: auth.expiration_time,
    createTime: auth.create_time,
    ...(Object.keys(honor).length > 0 ? { honorFields: honor } : {}),
    recordedAt: new Date().toISOString(),
  };
}

// Helpers shared by the PayPal e2e spec: the api over fetch, dev tokens, the fake PayPal's call log and screenshots.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";

export const API_URL = "http://localhost:3001";
export const FAKE_PAYPAL_URL = "http://localhost:4010";
export const SHOTS = "tests/e2e/screenshots";
export const DEMO_OWNER = "demo-owner@gottaeat.dev";
const API_JWT_SECRET = "e2e-jwt-secret";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://gottaeat:gottaeat@localhost:5432/gottaeat";

export function apiScript(script: string, args: string[]): string {
  return execFileSync("pnpm", ["--silent", "--filter", "@gottaeat/api", script, ...args], {
    env: { ...process.env, DATABASE_URL, API_JWT_SECRET },
    encoding: "utf8",
  }).trim();
}

export async function api(path: string, auth: string, init: { method?: string; body?: unknown; key?: string } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      authorization: `Bearer ${auth}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.key ? { "idempotency-key": init.key } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

export async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

export interface FakeCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  status: number;
  replayed: boolean;
}

export async function fakeCalls(path?: string): Promise<FakeCall[]> {
  const res = await fetch(`${FAKE_PAYPAL_URL}/__calls${path ? `?path=${encodeURIComponent(path)}` : ""}`);
  return (await res.json()) as FakeCall[];
}

export async function fakeReset() {
  await fetch(`${FAKE_PAYPAL_URL}/__reset`, { method: "POST" });
}

export function formatCents(cents: number): string {
  const dollars = ((cents - (cents % 100)) / 100).toLocaleString("en-US");
  return `$${dollars}.${String(cents % 100).padStart(2, "0")}`;
}

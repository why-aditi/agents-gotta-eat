import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type FakeResend, startFakeResend } from "../../../test/fake-resend";
import { DEFAULT_EMAIL_FROM, DEFAULT_WEB_URL, notifyConfigFromEnv, sendEmail } from "./send";

let resend: FakeResend;
beforeAll(async () => {
  resend = await startFakeResend();
});
afterAll(() => resend.close());
beforeEach(() => {
  resend.requests.length = 0;
});

const email = {
  to: "owner@test.local",
  subject: "Hi",
  html: "<p>Hi</p>",
  text: "Hi",
  idempotencyKey: "approval:spr_1",
};

describe("notifyConfigFromEnv", () => {
  it("defaults the sender and the web URL, and trims trailing slashes", () => {
    expect(notifyConfigFromEnv({})).toEqual({
      apiKey: undefined,
      apiUrl: "https://api.resend.com",
      from: DEFAULT_EMAIL_FROM,
      webUrl: DEFAULT_WEB_URL,
    });
    expect(notifyConfigFromEnv({ RESEND_API_KEY: " ", WEB_URL: "https://web.example/" })).toMatchObject({
      apiKey: undefined,
      webUrl: "https://web.example",
    });
  });
});

describe("sendEmail", () => {
  it("POSTs /emails with the key, the idempotency key and the JSON body", async () => {
    const cfg = notifyConfigFromEnv({ RESEND_API_KEY: "re_test", RESEND_API_URL: resend.url, EMAIL_FROM: "A <a@b.c>" });
    expect(await sendEmail(cfg, email)).toBe(true);
    expect(resend.requests).toHaveLength(1);
    const [req] = resend.requests;
    expect(req?.method).toBe("POST");
    expect(req?.url).toBe("/emails");
    expect(req?.headers.authorization).toBe("Bearer re_test");
    expect(req?.headers["idempotency-key"]).toBe("approval:spr_1");
    expect(req?.headers["content-type"]).toBe("application/json");
    expect(req?.body).toEqual({
      from: "A <a@b.c>",
      to: ["owner@test.local"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("throws on a non-2xx answer, so the job retries", async () => {
    const cfg = notifyConfigFromEnv({ RESEND_API_KEY: "re_test", RESEND_API_URL: resend.url });
    resend.failNext(429);
    await expect(sendEmail(cfg, email)).rejects.toThrow(/429/);
    resend.failNext(500);
    await expect(sendEmail(cfg, email)).rejects.toThrow(/500/);
  });

  it("sends nothing without a key", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    try {
      const cfg = notifyConfigFromEnv({ RESEND_API_URL: resend.url });
      expect(await sendEmail(cfg, email)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(resend.requests).toHaveLength(0);
  });
});

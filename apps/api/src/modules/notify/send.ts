// Sending one email through Resend's REST API (no SDK). Without RESEND_API_KEY nothing is sent. A non-2xx answer
// throws, so the pg-boss job retries; the same Idempotency-Key makes a retried send a no-op at Resend.
export interface NotifyEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  WEB_URL?: string;
  RESEND_API_URL?: string;
}

export interface NotifyConfig {
  // Unset: email is off.
  apiKey: string | undefined;
  apiUrl: string;
  from: string;
  // Where email links point (the web app), without a trailing slash.
  webUrl: string;
}

export const DEFAULT_EMAIL_FROM = "Agents Gotta Eat <onboarding@resend.dev>";
export const DEFAULT_WEB_URL = "http://localhost:3000";
const DEFAULT_RESEND_API_URL = "https://api.resend.com";
const SEND_TIMEOUT_MS = 10_000;

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export function notifyConfigFromEnv(env: NotifyEnv): NotifyConfig {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || undefined,
    apiUrl: trimSlash(env.RESEND_API_URL?.trim() || DEFAULT_RESEND_API_URL),
    from: env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM,
    webUrl: trimSlash(env.WEB_URL?.trim() || DEFAULT_WEB_URL),
  };
}

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

// Resolves to false when email is off (nothing sent), true once Resend accepted it.
export async function sendEmail(cfg: NotifyConfig, email: Email): Promise<boolean> {
  if (!cfg.apiKey) return false;
  const res = await fetch(`${cfg.apiUrl}/emails`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`resend answered ${res.status}: ${body}`);
  }
  await res.body?.cancel();
  return true;
}

# @gottaeat/web

Owner UI (Next.js 15 App Router). Owners sign in, register agents, write mandates, approve spends and check their wallet. Every api call happens on the server (server components and server actions) through `lib/api.ts`, which signs a 10-minute HS256 token for the signed-in user with `API_JWT_SECRET`. The browser never holds an api token.

## Run locally

1. Copy `.env.example` to `.env` at the repo root and set `AUTH_SECRET` (`openssl rand -base64 32`), `API_JWT_SECRET` (same value the api uses) and `DEMO_LOGIN=true` (or the GitHub pair below).
2. Start Postgres and the api (see the root README), then from the repo root: `pnpm dev`. The web is on http://localhost:3000.
3. Tests: `pnpm --filter @gottaeat/web test`. Component tests opt into jsdom with `// @vitest-environment jsdom` on their first line; everything else runs in node.

## Environment (Vercel)

| Variable                               | Value                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SECRET`                          | Random secret for the session cookie: `openssl rand -base64 32`                                                                                                                                                                                                                |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | From the GitHub OAuth app below. GitHub sign-in is hidden unless both are set                                                                                                                                                                                                  |
| `DEMO_LOGIN`                           | `true` shows "Continue as demo owner" (signs in as `demo-owner@gottaeat.dev` with no password). Demo deployments only                                                                                                                                                          |
| `API_URL`                              | The api's public URL on Render, e.g. `https://gottaeat-api.onrender.com` (no trailing slash needed)                                                                                                                                                                            |
| `API_JWT_SECRET`                       | Exactly the same value as the api's `API_JWT_SECRET` on Render                                                                                                                                                                                                                 |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID`         | The PayPal sandbox app's public client id (same app as the api's `PAYPAL_CLIENT_ID`). Public by design; the secret never goes to the web. Without it the "Pay with PayPal" buttons show "PayPal is not configured". It is inlined at build time, so redeploy after changing it |

Set the Vercel project's Root Directory to `apps/web`.

## GitHub OAuth app

GitHub, Settings, Developer settings, OAuth Apps, New OAuth App:

- Homepage URL: `https://<web>` (your Vercel URL; `http://localhost:3000` for a local app)
- Authorization callback URL: `https://<web>/api/auth/callback/github` (`http://localhost:3000/api/auth/callback/github` locally)

Copy the Client ID into `AUTH_GITHUB_ID` and generate a client secret for `AUTH_GITHUB_SECRET`. GitHub allows one callback URL per app, so use separate apps for local and production.

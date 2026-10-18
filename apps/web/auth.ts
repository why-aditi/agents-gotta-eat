// Auth.js v5: GitHub OAuth, plus a no-input "demo owner" login when DEMO_LOGIN=true.
// JWT session in Auth.js's encrypted cookie; no database adapter. The api never sees this cookie:
// lib/api.ts signs a separate short-lived token per call.
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

export const DEMO_OWNER = { email: "demo-owner@gottaeat.dev", name: "Demo owner" } as const;

export function githubEnabled(): boolean {
  return Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

export function demoEnabled(): boolean {
  return process.env.DEMO_LOGIN === "true";
}

function providers(): Provider[] {
  const list: Provider[] = [];
  if (githubEnabled()) {
    list.push(GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }));
  }
  if (demoEnabled()) {
    list.push(
      Credentials({
        id: "demo",
        name: "Demo owner",
        credentials: {},
        authorize: () => ({ id: DEMO_OWNER.email, ...DEMO_OWNER }),
      }),
    );
  }
  return list;
}

// A plain config object (not the lazy `() => config` form): lazy init makes `auth(handler)` return a promise,
// which breaks middleware. Providers are read from env when the server starts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: providers(),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.email === "string") session.user.email = token.email;
      session.user.name = typeof token.name === "string" ? token.name : null;
      return session;
    },
  },
});

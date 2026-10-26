// Web unit tests. Default environment is node (route handlers, lib/*). Component tests opt into jsdom with a
// `// @vitest-environment jsdom` comment on the first line of the *.test.tsx file.
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// Forward slashes with a trailing slash: on Windows `here("./")` has backslashes, which Vite does not resolve.
const root = `${path.resolve(here("./")).replaceAll("\\", "/")}/`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // `server-only` throws outside a React Server Components build; in tests it's a no-op.
      { find: /^server-only$/, replacement: here("./test/server-only-stub.ts") },
    ],
  },
  test: {
    environment: "node",
    // Form tests type character by character; on a slow machine (Windows) 5s is not always enough.
    testTimeout: 15_000,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});

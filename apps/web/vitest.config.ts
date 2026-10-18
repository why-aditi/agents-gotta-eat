// Web unit tests. Default environment is node (route handlers, lib/*). Component tests opt into jsdom with a
// `// @vitest-environment jsdom` comment on the first line of the *.test.tsx file.
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/": here("./"),
      // `server-only` throws outside a React Server Components build; in tests it's a no-op.
      "server-only": here("./test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});

// How to run pnpm from a spec. Under `pnpm e2e` / `pnpm load`, npm_execpath is pnpm's JS entry: run it with node, since a
// bare `pnpm` is a .cmd shim that cannot be spawned on Windows. Anywhere else (npx, a plain `playwright test`) use `pnpm`.
const entry = process.env.npm_execpath;
export const PNPM: [string, string[]] = entry && /pnpm/i.test(entry) ? [process.execPath, [entry]] : ["pnpm", []];

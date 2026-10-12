#!/usr/bin/env node
import { logError, main } from "./main.ts";

main().then(
  (code) => {
    if (code !== undefined) process.exit(code);
  },
  (error: unknown) => {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);

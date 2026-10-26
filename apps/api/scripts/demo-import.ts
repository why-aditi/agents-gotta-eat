// `pnpm demo:import [file]`: loads a recorded run (default seed/recordings/rehearsal.json) into recordings.
// Idempotent by title; features it when nothing is featured. Needs DATABASE_URL.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RecordingFile } from "@gottaeat/schemas";
import { createDb, requireDatabaseUrl } from "../src/db";
import { importRecording } from "../src/modules/demo";

const DEFAULT_FILE = fileURLToPath(new URL("../../../seed/recordings/rehearsal.json", import.meta.url));

// pnpm --filter runs this from apps/api; a relative path is read from where the command was typed.
const arg = process.argv.slice(2).find((a) => a !== "--");
const file = arg ? resolve(process.env.INIT_CWD ?? process.cwd(), arg) : DEFAULT_FILE;
const parsed = RecordingFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error(`demo:import: ${file} is not a recording file:\n${parsed.error.message}`);
  process.exit(1);
}

const { pool, db } = createDb(requireDatabaseUrl());
try {
  const { recording, created, featured } = await importRecording(db, parsed.data);
  console.log(
    `demo:import: ${created ? "imported" : "already there:"} ${recording.id} "${recording.title}" ` +
      `(${recording.eventCount} events)${featured ? ", featured" : ""}`,
  );
} finally {
  await pool.end();
}

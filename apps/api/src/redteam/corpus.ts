// The red-team corpus (tests/red-team/corpus.json), shared by the CI suite and `pnpm redteam`.
import { readFileSync } from "node:fs";

export interface SubmissionCase {
  id: string;
  class: string;
  taskType: "creative_writing" | "extract_data";
  // prefilter: flagged, so never auto-picked; verifier: extract_data's verifier fails it without an LLM;
  // residual: obfuscation the pre-filter can't see, a documented limit.
  expect: "prefilter" | "residual" | "verifier";
  text?: string;
  content?: unknown;
  padChars?: number;
}

export interface ReasonCase {
  id: string;
  class?: string;
  via: "spend" | "hire";
  // Absent on benign reasons.
  expect?: "screen" | "residual";
  text: string;
}

export interface Corpus {
  submissions: SubmissionCase[];
  spendReasons: ReasonCase[];
  benignReasons: ReasonCase[];
  benignSubmissions: { id: string; text: string }[];
}

export function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(new URL("../../../../tests/red-team/corpus.json", import.meta.url), "utf8")) as Corpus;
}

// The injected text, behind the padding the case asks for (a long story ahead of the instruction).
export function caseText(c: SubmissionCase): string {
  const pad = c.padChars ? `${"Coffee arrives by post every month. ".repeat(Math.ceil(c.padChars / 36))}\n` : "";
  return pad + (c.text ?? "");
}

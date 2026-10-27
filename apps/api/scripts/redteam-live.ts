// `pnpm redteam`: runs the red-team corpus against the real LLM gateway with the real prompts, and prints what the
// model did and what the platform's defences make of it. Informational: a fooled model is reported, not a failure.
// It exits 1 only when an outcome after the defences is wrong (a flagged entry left pickable, a screened reason
// allowed). Needs GATEWAY_URL, LITELLM_MASTER_KEY and DATABASE_URL (calls are logged in llm_calls and count against
// LLM_DAILY_REQUEST_BUDGET). Extraction cases use no model and are left to the CI suite.
import { readFileSync } from "node:fs";
import { createDb, requireDatabaseUrl } from "../src/db";
import { rankCreativeWriting } from "../src/modules/judge";
import { flagInjection, flagSpendReason, llmConfigFromEnv } from "../src/modules/llm";
import { selectIntentCheck } from "../src/modules/policy";
import { caseText, loadCorpus } from "../src/redteam/corpus";

const story = JSON.parse(
  readFileSync(new URL("../../../seed/bounties/product-story.json", import.meta.url), "utf8"),
) as { spec: { brief: string; rubric: string } };

const { db, pool } = createDb(requireDatabaseUrl());
const cfg = llmConfigFromEnv(db, process.env);
if (!cfg) {
  console.error("redteam: GATEWAY_URL is not set; live mode needs the gateway (the CI suite needs none).");
  process.exit(1);
}

const corpus = loadCorpus();
const rows: string[][] = [];
let wrong = 0;
let fooled = 0;

try {
  const [clean1, clean2] = corpus.benignSubmissions;
  for (const c of corpus.submissions.filter((s) => s.taskType === "creative_writing")) {
    const text = caseText(c);
    const flags = flagInjection(text);
    const res = await rankCreativeWriting(cfg, {
      brief: story.spec.brief,
      rubric: story.spec.rubric,
      submissions: [
        { entryId: "ent_INJECTED", text },
        { entryId: "ent_CLEAN1", text: clean1!.text },
        { entryId: "ent_CLEAN2", text: clean2!.text },
      ],
    });
    if (!res.ok) {
      rows.push([c.id, c.class, "judge failed", flags.join(",") || "-", `no ranking (${res.failure}); poster picks`]);
      continue;
    }
    const scores = new Map(res.judgements.map((j) => [j.entryId, j.score]));
    const mine = scores.get("ent_INJECTED") ?? 0;
    const top =
      Math.max(...scores.values()) === mine && mine > Math.max(scores.get("ent_CLEAN1")!, scores.get("ent_CLEAN2")!);
    if (top) fooled += 1;
    // Flagged entries are never auto-picked, whatever the score. Residual ones depend on the model.
    let outcome: string;
    if (flags.length > 0) outcome = "flagged: never auto-picked";
    else if (c.expect === "prefilter") {
      outcome = "WRONG: expected a flag";
      wrong += 1;
    } else outcome = top ? "residual: would be auto-picked if the poster doesn't pick" : "residual: ranked below";
    rows.push([c.id, c.class, `score ${mine}${top ? " (top)" : ""}`, flags.join(",") || "-", outcome]);
  }

  const check = selectIntentCheck(process.env.POLICY_GATE2_STUB, cfg);
  for (const c of [...corpus.spendReasons, ...corpus.benignReasons]) {
    const res = await check({
      agentId: "agt_REDTEAM",
      payeeAgentId: "agt_PAYEE",
      amountCents: 400n,
      feeCents: c.via === "hire" ? 8n : 0n,
      category: c.via === "hire" ? "subcontract" : "tool",
      bountyId: null,
      reason: c.text,
    });
    const flags = flagSpendReason(c.text);
    const model = (res.detail?.innerVerdict as string | undefined) ?? res.verdict;
    if (c.expect && model === "allow") fooled += 1;
    let outcome = `${res.verdict}`;
    if (c.expect === "screen" && res.verdict === "allow") {
      outcome = "WRONG: allowed";
      wrong += 1;
    } else if (!c.expect) outcome = res.verdict === "allow" ? "allow (benign)" : `${res.verdict} (benign, owner asked)`;
    rows.push([c.id, c.class ?? "benign", `model ${model}`, flags.join(",") || "-", outcome]);
  }
} finally {
  await pool.end();
}

const head = ["case", "class", "model", "pre-filter", "outcome after defences"];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
const line = (r: string[]) => r.map((v, i) => v.padEnd(widths[i]!)).join("  ");
console.log(line(head));
for (const r of rows) console.log(line(r));
const injectedCount = rows.filter((r) => r[1] !== "benign").length;
console.log(
  `\nredteam: ${injectedCount} injected cases; the model was fooled ${fooled} times; ` +
    `${wrong} wrong outcome${wrong === 1 ? "" : "s"} after defences.`,
);
process.exit(wrong > 0 ? 1 : 0);

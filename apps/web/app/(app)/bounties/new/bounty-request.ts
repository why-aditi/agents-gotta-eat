// Turns the create form's strings into a CreateBountyRequest. Dollars are parsed by string (lib/money), the fee is
// integer maths on cents, and hidden material typed as JSON is parsed here so mistakes show next to the field.
import { CreateBountyRequest, MAX_BOUNTY_HOURS, type SupportedTaskType } from "@gottaeat/schemas";
import { parseDollarsToCents } from "@/lib/money";

export interface BountyValues {
  taskType: SupportedTaskType;
  title: string;
  reward: string;
  deadline: string;
  spendRulePct: string;
  passThreshold: string;
  // creative_writing
  brief: string;
  rubric: string;
  // extract_data
  instructions: string;
  schema: string;
  sources: string;
  answerKey: string;
}

export type BountyField = keyof BountyValues;
export type BountyErrors = Partial<Record<BountyField, string>>;

// 10% of the reward, rounded half up, the same as the api. Integer maths only.
export function bountyFeeCents(rewardCents: number): number {
  const scaled = rewardCents * 10 + 50;
  return (scaled - (scaled % 100)) / 100;
}

// datetime-local without a zone, read and written as UTC so server and browser agree.
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const INT_RE = /^\d{1,3}$/;
const SOURCES_HINT = 'Sources are a JSON list of 1 to 10 {"name", "content"} objects.';
// Request keys whose form field has another name.
const FIELD_OF: Record<string, BountyField> = { rewardCents: "reward", deadlineAt: "deadline" };

// "2026-10-27T12:00" for a Date, in UTC.
export function toDatetimeLocal(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export function emptyValues(defaultDeadline: string): BountyValues {
  return {
    taskType: "creative_writing",
    title: "",
    reward: "",
    deadline: defaultDeadline,
    spendRulePct: "10",
    passThreshold: "60",
    brief: "",
    rubric: "",
    instructions: "",
    schema: "",
    sources: "",
    answerKey: "",
  };
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function intInRange(text: string, min: number, max: number): number | null {
  const s = text.trim();
  if (!INT_RE.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

export function toCreateRequest(
  v: BountyValues,
  now: Date,
): { ok: true; body: CreateBountyRequest } | { ok: false; errors: BountyErrors } {
  const errors: BountyErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = "Give the bounty a title.";
  else if (title.length > 200) errors.title = "Keep the title under 200 characters.";

  const reward = parseDollarsToCents(v.reward);
  if (!reward.ok) errors.reward = reward.error;
  else if (reward.cents < 100) errors.reward = "The reward must be at least $1.00.";

  let deadlineAt = "";
  const deadline = v.deadline.trim();
  const date = DATETIME_LOCAL_RE.test(deadline) ? new Date(`${deadline}:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) errors.deadline = "Pick a date and time.";
  else if (date.getTime() <= now.getTime()) errors.deadline = "Pick a time in the future.";
  else if (date.getTime() - now.getTime() > MAX_BOUNTY_HOURS * 3_600_000) {
    errors.deadline = `The deadline can be at most ${MAX_BOUNTY_HOURS} hours away.`;
  } else deadlineAt = date.toISOString();

  const spendRulePct = intInRange(v.spendRulePct, 0, 50);
  if (spendRulePct === null) errors.spendRulePct = "A whole number from 0 to 50.";
  const passThreshold = intInRange(v.passThreshold, 0, 100);
  if (passThreshold === null) errors.passThreshold = "A whole number from 0 to 100.";

  let body: unknown;
  const base = {
    title,
    rewardCents: reward.ok ? reward.cents : 0,
    deadlineAt,
    spendRulePct: spendRulePct ?? 0,
    passThreshold: passThreshold ?? 0,
  };
  if (v.taskType === "creative_writing") {
    if (!v.brief.trim()) errors.brief = "Write the brief entrants will see.";
    if (!v.rubric.trim()) errors.rubric = "Write the rubric you will judge by.";
    body = { ...base, taskType: "creative_writing", spec: { brief: v.brief.trim(), rubric: v.rubric.trim() } };
  } else {
    if (!v.instructions.trim()) errors.instructions = "Tell entrants what to extract.";
    const schema = v.schema.trim() ? parseJson(v.schema) : null;
    if (!schema) errors.schema = "Paste the JSON Schema submissions must match.";
    else if (!schema.ok) errors.schema = "This isn't valid JSON.";
    else if (typeof schema.value !== "object" || schema.value === null || Array.isArray(schema.value)) {
      errors.schema = "The schema must be a JSON object.";
    }
    const sources = v.sources.trim() ? parseJson(v.sources) : null;
    if (!sources) errors.sources = 'Paste at least one source, like [{"name": "invoice.txt", "content": "…"}].';
    else if (!sources.ok) errors.sources = "This isn't valid JSON.";
    const answerKey = v.answerKey.trim() ? parseJson(v.answerKey) : null;
    if (!answerKey) errors.answerKey = "Paste the answer key. Entrants never see it.";
    else if (!answerKey.ok) errors.answerKey = "This isn't valid JSON.";
    body = {
      ...base,
      taskType: "extract_data",
      spec: {
        instructions: v.instructions.trim(),
        schema: schema?.ok ? schema.value : {},
        sources: sources?.ok ? sources.value : [],
      },
      hidden: { answerKey: answerKey?.ok ? answerKey.value : null },
    };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // The field checks above cover the common mistakes; the schema catches the rest (e.g. a malformed source).
  const parsed = CreateBountyRequest.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [top = "", sub = ""] = issue.path.map(String);
      const key = top === "spec" ? sub : top === "hidden" ? "answerKey" : (FIELD_OF[top] ?? top);
      const field: BountyField = key in v ? (key as BountyField) : "title";
      errors[field] ??= field === "sources" ? SOURCES_HINT : issue.message;
    }
    return { ok: false, errors };
  }
  return { ok: true, body: parsed.data };
}

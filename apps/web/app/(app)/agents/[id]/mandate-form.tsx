"use client";

// Mandate editor. "Compile from my words" asks the api's LLM compiler to fill the rule fields from the text (nothing
// is saved). Every save adds a new, unconfirmed version; the review card then shows the owner's words next to
// the rules they compile to, and "Confirm mandate" activates it. Amounts are parsed from strings into integer
// cents (lib/money); no float maths.
import type { Mandate, MandateRules, PutMandateRequest, SpendCategory } from "@gottaeat/schemas";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, formatTenths, parseDollarsToCents, parseRatingToTenths } from "@/lib/money";
import { compileMandate, saveMandate } from "./actions";
import { MandateReview } from "./mandate-review";

const CATEGORIES: SpendCategory[] = ["tool", "subcontract", "stake"];
type Scope = PutMandateRequest["rules"]["scope"];

export interface MandateValues {
  sourceText: string;
  perTx: string;
  daily: string;
  askAbove: string;
  categories: SpendCategory[];
  payees: string;
  rating: string;
  scope: Scope;
  expires: string;
}

type Field = keyof MandateValues;
export type FieldErrors = Partial<Record<Field, string>>;

// datetime-local without a zone, read and written as UTC so server and browser agree.
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function valuesFrom(mandate: Mandate | null): MandateValues {
  if (!mandate) {
    return {
      sourceText: "",
      perTx: "",
      daily: "",
      askAbove: "",
      categories: ["tool"],
      payees: "",
      rating: "",
      scope: "any",
      expires: "",
    };
  }
  return valuesFromRules(mandate.sourceText, mandate.rules);
}

export function valuesFromRules(sourceText: string, rules: MandateRules): MandateValues {
  return {
    sourceText,
    perTx: centsToInput(rules.perTxMaxCents),
    daily: centsToInput(rules.dailyMaxCents),
    askAbove: rules.askAboveCents === undefined ? "" : centsToInput(rules.askAboveCents),
    categories: [...rules.allowedCategories],
    payees: rules.payeeAllowlist?.join(", ") ?? "",
    rating: rules.minPayeeRatingTenths === undefined ? "" : formatTenths(rules.minPayeeRatingTenths),
    scope: rules.scope,
    expires: rules.expiresAt ? new Date(rules.expiresAt).toISOString().slice(0, 16) : "",
  };
}

export function toRequest(
  v: MandateValues,
  now: Date,
): { ok: true; body: PutMandateRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const sourceText = v.sourceText.trim();
  if (!sourceText) errors.sourceText = "Describe what this agent may spend on, in your own words.";
  else if (sourceText.length > 4000) errors.sourceText = "Keep it under 4,000 characters.";

  const perTx = parseDollarsToCents(v.perTx);
  if (!perTx.ok) errors.perTx = perTx.error;
  const daily = parseDollarsToCents(v.daily);
  if (!daily.ok) errors.daily = daily.error;
  const askAbove = v.askAbove.trim() ? parseDollarsToCents(v.askAbove) : null;
  if (askAbove && !askAbove.ok) errors.askAbove = askAbove.error;

  const categories = CATEGORIES.filter((c) => v.categories.includes(c));
  if (categories.length === 0) errors.categories = "Pick at least one category.";

  const payees = v.payees
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (payees.some((p) => p.length > 64)) errors.payees = "Agent ids are at most 64 characters.";

  const rating = v.rating.trim() ? parseRatingToTenths(v.rating) : null;
  if (rating && !rating.ok) errors.rating = rating.error;

  let expiresAt: string | null = null;
  const expires = v.expires.trim();
  if (expires) {
    const date = DATETIME_LOCAL_RE.test(expires) ? new Date(`${expires}:00.000Z`) : null;
    if (!date || Number.isNaN(date.getTime())) errors.expires = "Pick a date and time.";
    else if (date.getTime() <= now.getTime()) errors.expires = "Pick a time in the future.";
    else expiresAt = date.toISOString();
  }

  if (Object.keys(errors).length > 0 || !perTx.ok || !daily.ok) return { ok: false, errors };
  return {
    ok: true,
    body: {
      sourceText,
      rules: {
        perTxMaxCents: perTx.cents,
        dailyMaxCents: daily.cents,
        ...(askAbove?.ok ? { askAboveCents: askAbove.cents } : {}),
        allowedCategories: categories,
        payeeAllowlist: payees.length > 0 ? payees : null,
        ...(rating?.ok ? { minPayeeRatingTenths: rating.tenths } : {}),
        scope: v.scope,
        expiresAt,
      },
    },
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function MandateForm({ agentId, initial }: { agentId: string; initial: Mandate | null }) {
  const uid = useId();
  const [values, setValues] = useState<MandateValues>(() => valuesFrom(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [review, setReview] = useState<Mandate | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [compiling, startCompile] = useTransition();

  const id = (field: Field) => `${uid}-${field}`;
  const errId = (field: Field) => `${uid}-${field}-error`;
  const set = <K extends Field>(field: K, value: MandateValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };
  const invalidProps = (field: Field) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": errId(field) } : {};

  function toggleCategory(category: SpendCategory, checked: boolean) {
    set("categories", checked ? [...values.categories, category] : values.categories.filter((c) => c !== category));
  }

  function onCompile() {
    const sourceText = values.sourceText.trim();
    if (!sourceText) {
      setErrors((prev) => ({ ...prev, sourceText: "Describe what this agent may spend on, in your own words." }));
      return;
    }
    startCompile(async () => {
      const result = await compileMandate(agentId, sourceText);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // Fill the rule fields; the owner still reviews, saves and confirms.
      setValues(valuesFromRules(values.sourceText, result.data.rules));
      setErrors({});
      setNotes(result.data.notes);
      toast.success("Rules filled in from your words. Check them before saving.");
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = toRequest(values, new Date());
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveMandate(agentId, parsed.body);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setReview(result.data);
      toast.success(`Saved as version ${result.data.version}. Review and confirm it to make it active.`);
    });
  }

  return (
    <div className="space-y-6">
      {review ? <MandateReview agentId={agentId} mandate={review} onDone={() => setReview(null)} /> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={id("sourceText")}>What should this agent be allowed to do?</Label>
          <Textarea
            id={id("sourceText")}
            required
            rows={4}
            maxLength={4000}
            placeholder="Buy tools up to $10 each, at most $50 a day. Ask me about anything over $5."
            value={values.sourceText}
            onChange={(e) => set("sourceText", e.target.value)}
            {...invalidProps("sourceText")}
          />
          <FieldError id={errId("sourceText")} message={errors.sourceText} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={onCompile} disabled={compiling || pending}>
              {compiling ? "Compiling…" : "Compile from my words"}
            </Button>
            <p className="text-xs text-muted-foreground">Fills in the fields below. Nothing is saved until you save.</p>
          </div>
          {notes && notes.length > 0 ? (
            <div role="note" aria-label="Compiler notes" className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Notes from the compiler</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["perTx", "Per-spend cap ($)", "10.00"],
              ["daily", "Daily cap ($)", "50.00"],
              ["askAbove", "Ask me above ($)", "Optional"],
            ] as const
          ).map(([field, label, placeholder]) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={id(field)}>{label}</Label>
              <Input
                id={id(field)}
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholder}
                value={values[field]}
                onChange={(e) => set(field, e.target.value)}
                {...invalidProps(field)}
              />
              <FieldError id={errId(field)} message={errors[field]} />
            </div>
          ))}
        </div>

        <fieldset className="space-y-2" {...invalidProps("categories")}>
          <legend className="text-sm leading-none font-medium">Categories</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            {CATEGORIES.map((category) => (
              <div key={category} className="flex items-center gap-2">
                <Checkbox
                  id={`${uid}-cat-${category}`}
                  checked={values.categories.includes(category)}
                  onCheckedChange={(checked) => toggleCategory(category, checked === true)}
                />
                <Label htmlFor={`${uid}-cat-${category}`} className="font-normal">
                  {category}
                </Label>
              </div>
            ))}
          </div>
          <FieldError id={errId("categories")} message={errors.categories} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={id("payees")}>Allowed payees</Label>
            <Input
              id={id("payees")}
              autoComplete="off"
              placeholder="agt_…, agt_… (blank = anyone)"
              value={values.payees}
              onChange={(e) => set("payees", e.target.value)}
              aria-describedby={errors.payees ? errId("payees") : `${uid}-payees-hint`}
              aria-invalid={errors.payees ? true : undefined}
            />
            <p id={`${uid}-payees-hint`} className="text-xs text-muted-foreground">
              Comma-separated agent ids. Leave blank to allow any agent.
            </p>
            <FieldError id={errId("payees")} message={errors.payees} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("rating")}>Minimum payee rating</Label>
            <Input
              id={id("rating")}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0 to 5.0 (optional)"
              value={values.rating}
              onChange={(e) => set("rating", e.target.value)}
              {...invalidProps("rating")}
            />
            <FieldError id={errId("rating")} message={errors.rating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("scope")}>Scope</Label>
            <Select value={values.scope} onValueChange={(v) => set("scope", v as Scope)}>
              <SelectTrigger id={id("scope")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="current_bounty_only">Current bounty only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("expires")}>Expires</Label>
            <Input
              id={id("expires")}
              type="datetime-local"
              value={values.expires}
              onChange={(e) => set("expires", e.target.value)}
              aria-describedby={errors.expires ? errId("expires") : `${uid}-expires-hint`}
              aria-invalid={errors.expires ? true : undefined}
            />
            <p id={`${uid}-expires-hint`} className="text-xs text-muted-foreground">
              Optional. In UTC.
            </p>
            <FieldError id={errId("expires")} message={errors.expires} />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save as new version"}
        </Button>
      </form>
    </div>
  );
}

"use client";

// Create a bounty, with a live preview of its dish card (ui-05). Fields are strings until submit; toCreateRequest turns them into integer cents and parsed JSON
// and checks them against CreateBountyRequest. The api's own errors show inline above the button. The
// Idempotency-Key is made when the form renders and renewed after a definite rejection, so a fixed form can resend.
import type { SupportedTaskType } from "@gottaeat/schemas";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { type DishBounty, DishCard } from "../dish-card";
import { createBounty } from "./actions";
import {
  type BountyErrors,
  type BountyField,
  type BountyValues,
  bountyFeeCents,
  emptyValues,
  toCreateRequest,
} from "./bounty-request";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

function Total({ reward }: { reward: string }) {
  const parsed = parseDollarsToCents(reward);
  if (!parsed.ok || parsed.cents === 0) {
    return <p className="text-sm text-muted-foreground">Enter a reward to see the total. The fee is 10%.</p>;
  }
  const fee = bountyFeeCents(parsed.cents);
  return (
    <p className="text-sm tabular-nums" aria-live="polite" data-testid="bounty-total">
      Reward {formatCents(parsed.cents)} + fee {formatCents(fee)} ={" "}
      <span className="font-semibold">{formatCents(parsed.cents + fee)}</span>
    </p>
  );
}

// The dish card as it will look once funded: open, with the deadline counting down. Unparsed fields show as zero.
export function previewBounty(values: BountyValues): DishBounty {
  const reward = parseDollarsToCents(values.reward);
  const deadline = Date.parse(`${values.deadline}:00Z`);
  return {
    id: "preview",
    title: values.title.trim(),
    taskType: values.taskType,
    rewardCents: reward.ok ? reward.cents : 0,
    status: Number.isNaN(deadline) ? "draft" : "open",
    deadlineAt: Number.isNaN(deadline) ? new Date(0).toISOString() : new Date(deadline).toISOString(),
    entryCount: 0,
    entrants: [],
  };
}

export function CreateBountyForm({ defaultDeadline }: { defaultDeadline: string }) {
  const uid = useId();
  const router = useRouter();
  const [values, setValues] = useState<BountyValues>(() => emptyValues(defaultDeadline));
  const [errors, setErrors] = useState<BountyErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  const id = (field: BountyField) => `${uid}-${field}`;
  const errId = (field: BountyField) => `${uid}-${field}-error`;
  const set = <K extends BountyField>(field: K, value: BountyValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };
  const fieldProps = (field: BountyField) => ({
    id: id(field),
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
    ...(errors[field] ? { "aria-invalid": true as const, "aria-describedby": errId(field) } : {}),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = toCreateRequest(values, new Date());
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setApiError(null);
    startTransition(async () => {
      const result = await createBounty(parsed.body, key);
      if (result.ok) {
        toast.success("Bounty saved as a draft.");
        router.push(`/bounties/${encodeURIComponent(result.data.id)}`);
        return;
      }
      setApiError(result.message);
      // A network or server failure may be retried as is; anything else needs a changed form, so a new key.
      if (result.code !== "internal") setKey(crypto.randomUUID());
    });
  }

  const text = (field: BountyField, label: string, opts: { rows?: number; placeholder?: string; hint?: string }) => (
    <div className="space-y-2">
      <Label htmlFor={id(field)}>{label}</Label>
      <Textarea
        rows={opts.rows ?? 4}
        placeholder={opts.placeholder}
        className={field === "schema" || field === "sources" || field === "answerKey" ? "font-mono text-xs" : ""}
        {...fieldProps(field)}
      />
      {opts.hint ? <p className="text-xs text-muted-foreground">{opts.hint}</p> : null}
      <FieldError id={errId(field)} message={errors[field]} />
    </div>
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]"
    >
      <div className="space-y-6 lg:col-start-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={id("taskType")}>Task type</Label>
            <Select value={values.taskType} onValueChange={(v) => set("taskType", v as SupportedTaskType)}>
              <SelectTrigger id={id("taskType")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="creative_writing">Creative writing (you pick the winner)</SelectItem>
                <SelectItem value="extract_data">Extract data (checked against your answer key)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("title")}>Title</Label>
            <Input autoComplete="off" maxLength={200} {...fieldProps("title")} />
            <FieldError id={errId("title")} message={errors.title} />
          </div>
        </div>

        {values.taskType === "creative_writing" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {text("brief", "Brief", { placeholder: "What should entrants write?" })}
            {text("rubric", "Rubric", { placeholder: "How will you judge it?" })}
          </div>
        ) : (
          <div className="space-y-4">
            {text("instructions", "Instructions", { placeholder: "What should entrants extract?" })}
            <div className="grid gap-4 md:grid-cols-2">
              {text("schema", "Output JSON Schema", {
                rows: 6,
                placeholder: '{"type": "object", "properties": {"total": {"type": "number"}}}',
                hint: "Submissions must validate against it.",
              })}
              {text("sources", "Sources (JSON)", {
                rows: 6,
                placeholder: '[{"name": "invoice.txt", "content": "Total: $12.00"}]',
                hint: "1 to 10 documents entrants extract from.",
              })}
            </div>
            {text("answerKey", "Answer key (JSON, hidden)", {
              rows: 4,
              placeholder: '{"total": 12}',
              hint: "Never shown to entrants. Submissions are scored against it.",
            })}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor={id("reward")}>Reward ($)</Label>
            <Input inputMode="decimal" autoComplete="off" placeholder="15.00" {...fieldProps("reward")} />
            <FieldError id={errId("reward")} message={errors.reward} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("deadline")}>Deadline (UTC)</Label>
            <Input type="datetime-local" {...fieldProps("deadline")} />
            <p className="text-xs text-muted-foreground">At most 72 hours away.</p>
            <FieldError id={errId("deadline")} message={errors.deadline} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("spendRulePct")}>Spend rule (%)</Label>
            <Input inputMode="numeric" autoComplete="off" {...fieldProps("spendRulePct")} />
            <p className="text-xs text-muted-foreground">Share of the reward an entrant may spend. 0 to 50.</p>
            <FieldError id={errId("spendRulePct")} message={errors.spendRulePct} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("passThreshold")}>Pass threshold</Label>
            <Input inputMode="numeric" autoComplete="off" {...fieldProps("passThreshold")} />
            <p className="text-xs text-muted-foreground">Minimum score (0 to 100) to win and get the stake back.</p>
            <FieldError id={errId("passThreshold")} message={errors.passThreshold} />
          </div>
        </div>
      </div>

      <aside aria-label="Preview" className="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <p className="text-xs font-medium text-muted-foreground">How it shows on the menu</p>
        <DishCard bounty={previewBounty(values)} testId="dish-preview" className="lg:sticky lg:top-20" />
      </aside>

      <div className="space-y-3 self-start rounded-xl border bg-muted/40 p-4 lg:col-start-1">
        <Total reward={values.reward} />
        {apiError ? (
          <p role="alert" className="text-sm text-destructive">
            {apiError}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}

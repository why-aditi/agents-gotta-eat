"use client";

// Ask the Treasurer a money question. The answer, the cited ids and the tool trace are shown as plain text only:
// the answer is model output built from third-party data, so it is never rendered as HTML or Markdown.
import type { TreasurerAnswer } from "@gottaeat/schemas";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { askTreasurer } from "./actions";

export const SUGGESTED_QUESTIONS = [
  "Why hasn't Scout's owner been paid?",
  "Does the ledger match PayPal this week?",
  "What happened to the last top-up?",
] as const;

const MAX = 500;

export function TreasurerPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<TreasurerAnswer | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuestion(text);
    setError(null);
    start(async () => {
      const res = await askTreasurer(text);
      if (res.ok) {
        setAnswer(res.data);
        setAsked(text);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ask the Treasurer</CardTitle>
          <CardDescription>
            Answers money questions from the ledger, payments, escrow and PayPal (read-only), citing the ids it used.
            Nothing it does moves money.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <Label htmlFor="treasurer-question">Question</Label>
            <Textarea
              id="treasurer-question"
              value={question}
              maxLength={MAX}
              rows={3}
              placeholder="e.g. Why hasn't Scout's owner been paid?"
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {question.length}/{MAX}
              </span>
              <Button type="submit" disabled={pending || question.trim().length === 0}>
                {pending ? "Asking…" : "Ask"}
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
            {SUGGESTED_QUESTIONS.map((q) => (
              <Button key={q} type="button" variant="outline" size="sm" disabled={pending} onClick={() => ask(q)}>
                {q}
              </Button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {answer ? (
        <Card data-testid="treasurer-answer" aria-busy={pending}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Answer
              {answer.fallback ? (
                <Badge variant="secondary">Fixed report (no LLM)</Badge>
              ) : (
                <Badge variant="outline">{answer.model}</Badge>
              )}
            </CardTitle>
            {asked ? <CardDescription className="break-words">{asked}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <p
              className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed"
              data-testid="treasurer-text"
            >
              {answer.answer}
            </p>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Cited ids</h3>
              {answer.cited.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Cited ids">
                  {answer.cited.map((id) => (
                    <li key={id}>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{id}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
            </div>
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Tool trace ({answer.trace.length} step{answer.trace.length === 1 ? "" : "s"})
              </summary>
              {answer.trace.length ? (
                <ol className="mt-2 space-y-1.5">
                  {answer.trace.map((step, i) => (
                    <li key={i} className="break-words font-mono text-xs">
                      <span className={step.ok ? "" : "text-destructive"}>{step.ok ? "ok " : "err "}</span>
                      {step.tool}({JSON.stringify(step.args)}) → {step.summary}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-muted-foreground">No tools were called.</p>
              )}
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

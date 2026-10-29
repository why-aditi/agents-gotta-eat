// ui-02: first steps for a new owner, until they have an agent and money in the wallet. ui-03: in kitchen words.
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Checklist({
  hasAgent,
  hasMandate,
  funded,
}: {
  hasAgent: boolean;
  hasMandate: boolean;
  funded: boolean;
}) {
  const steps = [
    {
      done: hasAgent,
      title: "Adopt your first agent",
      body: "Register it: it gets its own API key and a seat at the table.",
      href: "/agents",
    },
    {
      done: hasMandate,
      title: "Give it a diet",
      body: "A mandate in plain English, like “tools up to $10 each, ask me above $5”.",
      href: "/agents",
    },
    { done: funded, title: "Stock the pantry", body: "Top up with PayPal. Your agents eat from it.", href: "/wallet" },
  ];
  return (
    <section aria-labelledby="get-started" className="sticker bg-accent/50 p-5 sm:p-6">
      <h2 id="get-started" className="font-display text-xl font-semibold">
        Set up your kitchen
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className={cn(
                "flex h-full gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40",
                s.done && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  s.done ? "bg-allow text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <CheckIcon className="size-4" aria-label="Done" /> : i + 1}
              </span>
              <span>
                <span className="block font-medium">{s.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{s.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

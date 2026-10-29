"use client";

// Adopt (register) an agent. The Idempotency-Key is generated once per dialog open, so a double submit replays the
// first request instead of creating two agents. On success the dialog switches to the one-time key view.
import type { CreateAgentResponse } from "@gottaeat/schemas";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAgent } from "./actions";
import { KeyReveal } from "./key-reveal";

export const NAME_MAX = 80;

export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return "Enter a name for the agent.";
  if (name.length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters or fewer.`;
  return null;
}

export function RegisterDialog({ triggerLabel = "Adopt an agent" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateAgentResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (next) {
      setIdempotencyKey(crypto.randomUUID());
    } else {
      // Drop the plaintext key (and the rest of the form) as soon as the dialog closes.
      setCreated(null);
      setName("");
      setError(null);
      setIdempotencyKey("");
    }
    setOpen(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validateName(name);
    setError(problem);
    if (problem) return;
    startTransition(async () => {
      const result = await registerAgent(name.trim(), idempotencyKey);
      if (result.ok) {
        setCreated(result.data);
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.apiKey ? "Save your API key" : "Agent adopted"}</DialogTitle>
              <DialogDescription>
                {created.agent.name} is in your kitchen. Give the key to the agent, or connect it over MCP.
              </DialogDescription>
            </DialogHeader>
            <KeyReveal apiKey={created.apiKey} mcpConfig={created.mcpConfig} />
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Adopt an agent</DialogTitle>
              <DialogDescription>
                This creates an API key and MCP config for your agent. It spends from your wallet, within the diet you give it. You&apos;ll see the key once.
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                name="name"
                autoComplete="off"
                placeholder="e.g. Research helper"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "agent-name-error" : undefined}
                disabled={pending}
              />
              {error && (
                <p id="agent-name-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
                {pending ? "Adopting…" : "Adopt"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

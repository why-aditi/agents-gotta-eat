"use client";

// Per-row key actions: rotate (shows the new key once) and revoke. Both confirm first.
import type { RotateKeyResponse } from "@gottaeat/schemas";
import { EllipsisIcon, KeyRoundIcon, RotateCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { revokeKey, rotateKey } from "./actions";
import { KeyReveal } from "./key-reveal";

type Confirm = { kind: "rotate"; idempotencyKey: string } | { kind: "revoke" };

export function AgentActions({ agent }: { agent: { id: string; name: string; apiKeyPrefix: string | null } }) {
  // Kept after close so the dialog text doesn't flip during the close animation.
  const [confirm, setConfirm] = useState<Confirm>({ kind: "revoke" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotated, setRotated] = useState<RotateKeyResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const revoked = agent.apiKeyPrefix === null;

  function ask(next: Confirm) {
    setConfirm(next);
    setConfirmOpen(true);
  }

  function run() {
    startTransition(async () => {
      if (confirm.kind === "rotate") {
        const result = await rotateKey(agent.id, confirm.idempotencyKey);
        if (result.ok) {
          setConfirmOpen(false);
          setRotated(result.data);
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await revokeKey(agent.id);
        if (result.ok) {
          setConfirmOpen(false);
          toast.success(`Key revoked for ${agent.name}`);
        } else {
          toast.error(result.message);
        }
      }
    });
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${agent.name}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => ask({ kind: "rotate", idempotencyKey: crypto.randomUUID() })}>
            <RotateCwIcon /> {revoked ? "Issue new key" : "Rotate key"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={revoked} onSelect={() => ask({ kind: "revoke" })}>
            <KeyRoundIcon /> Revoke key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !next && !pending && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm.kind === "revoke" ? `Revoke the key for ${agent.name}?` : `Rotate the key for ${agent.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm.kind === "revoke"
                ? "The agent's key stops working at once, over REST and MCP. You can issue a new key later by rotating."
                : "The current key stops working at once. You'll see the new key one time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction: the dialog stays open until the api answers. */}
            <Button
              variant={confirm.kind === "revoke" ? "destructive" : "default"}
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={run}
            >
              {confirm.kind === "revoke" ? "Revoke key" : "Rotate key"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rotated !== null} onOpenChange={(next) => !next && setRotated(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New API key for {agent.name}</DialogTitle>
            <DialogDescription>
              The old key no longer works. Update the agent&apos;s config and any MCP client that used it.
            </DialogDescription>
          </DialogHeader>
          {rotated && <KeyReveal apiKey={rotated.apiKey} />}
          <DialogFooter>
            <Button type="button" onClick={() => setRotated(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

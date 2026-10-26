"use client";

// Fund (dev) for admins on a draft, and Cancel for the poster while nobody has entered. Keys are made once per
// render, so a double click replays instead of repeating.
import { useRouter } from "next/navigation";
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
import { cancelBounty, fundBountyDev } from "./actions";

export function BountyActions({
  bountyId,
  canFund,
  canCancel,
}: {
  bountyId: string;
  canFund: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [keys] = useState(() => ({ fund: crypto.randomUUID(), cancel: crypto.randomUUID() }));
  const [fundingOff, setFundingOff] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  function fund() {
    startTransition(async () => {
      const result = await fundBountyDev(bountyId, keys.fund);
      if (result.ok) toast.success("Bounty funded and open.");
      else if (result.code === "not_found") setFundingOff(true);
      else toast.error(result.message);
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelBounty(bountyId, keys.cancel);
      if (result.ok) {
        setConfirmCancel(false);
        toast.success("Bounty cancelled.");
      } else {
        toast.error(result.message);
      }
      router.refresh();
    });
  }

  if (!canFund && !canCancel) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canFund ? (
        fundingOff ? (
          <p className="text-sm text-muted-foreground">Dev funding is off on this server.</p>
        ) : (
          <Button onClick={fund} disabled={pending}>
            {pending ? "Funding…" : "Fund (dev)"}
          </Button>
        )
      ) : null}
      {canCancel ? (
        <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={pending}>
          Cancel bounty
        </Button>
      ) : null}

      <AlertDialog open={confirmCancel} onOpenChange={(next) => !next && !pending && setConfirmCancel(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this bounty?</AlertDialogTitle>
            <AlertDialogDescription>
              Nobody has entered yet. Cancelling closes it for good and it can&apos;t be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} aria-busy={pending || undefined} onClick={cancel}>
              Cancel bounty
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

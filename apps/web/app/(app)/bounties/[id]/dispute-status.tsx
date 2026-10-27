// Where an auto-judged result stands with respect to disputes (disp-01), worded for who is reading: the poster, the
// winning agent's owner, or anyone else. The poster's reason and the admin's note are untrusted text: plain text only.
import type { BountyResults } from "@gottaeat/schemas";
import { formatCents } from "@/lib/money";
import { LocalTime } from "../../_lib/local-time";

export type DisputeViewer = "poster" | "winner" | "other";

function Line({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="font-medium" data-testid="dispute-status">
      {children}
    </p>
  );
}

function Quoted({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function statusLine(
  dispute: NonNullable<BountyResults["dispute"]>,
  rewardCents: number,
  viewer: DisputeViewer,
): string {
  if (dispute.status === "open") return "Disputed: under review";
  if (dispute.status === "upheld") return "Dispute rejected: the result stands";
  if (viewer === "poster") return `Dispute overturned: ${formatCents(rewardCents)} refunded to you`;
  if (viewer === "winner") return "Dispute overturned: the reward went back to the poster";
  return `Dispute overturned: ${formatCents(rewardCents)} refunded to the poster`;
}

// `windowOpen`: disputeUntil is still in the future (worked out by the caller, so this renders the same everywhere).
export function DisputeStatus({
  results,
  rewardCents,
  viewer,
  windowOpen,
}: {
  results: Pick<BountyResults, "disputeUntil" | "dispute">;
  rewardCents: number;
  viewer: DisputeViewer;
  windowOpen: boolean;
}) {
  const { dispute, disputeUntil } = results;
  if (dispute) {
    return (
      <div className="space-y-3">
        <Line>{statusLine(dispute, rewardCents, viewer)}</Line>
        {dispute.status === "open" && viewer === "winner" ? (
          <p className="text-muted-foreground">Your reward stays held until an admin decides.</p>
        ) : null}
        <Quoted label={viewer === "poster" ? "Your reason" : "The poster's reason"} text={dispute.reason} />
        {dispute.note ? <Quoted label="Admin's note" text={dispute.note} /> : null}
      </div>
    );
  }
  if (!disputeUntil || !windowOpen) return null;
  return (
    <Line>
      {viewer === "winner" ? (
        <>
          Reward held until <LocalTime iso={disputeUntil} /> while the poster may dispute
        </>
      ) : (
        <>
          Results are final after <LocalTime iso={disputeUntil} />
        </>
      )}
    </Line>
  );
}

// Spend requests waiting for the owner, oldest first. Server-rendered; AutoRefresh re-renders every 10 seconds.
import { AgentList, SpendRequestList } from "@gottaeat/schemas";
import { unstable_rethrow } from "next/navigation";
import { CircleCheckIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { apiFetch } from "@/lib/api";
import { SUBTITLE } from "@/lib/kitchen";
import { PageError } from "../_lib/page-error";
import { ApprovalCard } from "./approval-card";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Approvals · Agents Gotta Eat" };

export default async function ApprovalsPage() {
  let loaded;
  try {
    const [{ spendRequests }, { agents }] = await Promise.all([
      apiFetch(SpendRequestList, "/v1/approvals?status=pending"),
      apiFetch(AgentList, "/v1/agents"),
    ]);
    loaded = { spendRequests, names: new Map(agents.map((a) => [a.id, a.name])) };
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    loaded = { error: err };
  }

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={10_000} />
      <PageHeader title="Approvals">{SUBTITLE.approvals}</PageHeader>
      {"error" in loaded ? (
        <PageError title="Couldn't load approvals" error={loaded.error} />
      ) : loaded.spendRequests.length === 0 ? (
        <EmptyState icon={CircleCheckIcon} title="Everyone's fed. Nothing needs you.">
          When an agent asks for more than you allowed, or the intent check is unsure, it begs here and by email.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {loaded.spendRequests.map((s) => (
            <ApprovalCard key={s.id} spend={s} agentName={loaded.names.get(s.agentId)} />
          ))}
        </div>
      )}
    </div>
  );
}

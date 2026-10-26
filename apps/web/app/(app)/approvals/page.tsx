// Spend requests waiting for the owner, oldest first. Server-rendered; AutoRefresh re-renders every 10 seconds.
import { AgentList, SpendRequestList } from "@gottaeat/schemas";
import { unstable_rethrow } from "next/navigation";
import { apiFetch } from "@/lib/api";
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Spends above your &quot;ask me above&quot; amount, or flagged by the intent check, wait here for 15 minutes.
        </p>
      </div>
      {"error" in loaded ? (
        <PageError title="Couldn't load approvals" error={loaded.error} />
      ) : loaded.spendRequests.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Nothing waiting for you.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {loaded.spendRequests.map((s) => (
            <ApprovalCard key={s.id} spend={s} agentName={loaded.names.get(s.agentId)} />
          ))}
        </div>
      )}
    </div>
  );
}

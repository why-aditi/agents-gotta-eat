// Agents: the owner's crew as creature cards (ui-04). Adopt, rotate and revoke happen in client components that
// call the server actions in ./actions. Approvals and activity only feed the moods, so either failing costs the
// mood, not the page.
import { AgentList, SpendRequestList, WalletActivity } from "@gottaeat/schemas";
import { UtensilsIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { apiFetch } from "@/lib/api";
import { crewMoods } from "@/lib/crew";
import { PageError } from "../_lib/page-error";
import { AgentCard } from "./agent-card";
import { RegisterDialog } from "./register-dialog";

export const metadata = { title: "Agents · Agents Gotta Eat" };

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    return null;
  }
}

export default async function AgentsPage() {
  const [agents, approvals, activity] = await Promise.all([
    apiFetch(AgentList, "/v1/agents").then(
      (r) => ({ ok: r.agents }) as const,
      (err: unknown) => {
        unstable_rethrow(err);
        return { error: err } as const;
      },
    ),
    orNull(apiFetch(SpendRequestList, "/v1/approvals?status=pending")),
    orNull(apiFetch(WalletActivity, "/v1/wallet/activity?limit=50")),
  ]);
  const crew =
    "ok" in agents
      ? crewMoods(agents.ok, approvals?.spendRequests ?? [], activity?.items ?? [], Date.now())
      : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agents"
        // One dialog in a fixed spot: it must stay mounted when adopting the first agent swaps the empty state for
        // the grid, or the one-time key view disappears with it.
        action={"ok" in agents ? <RegisterDialog /> : undefined}
      >
        Your crew. Each one has its own key, its own diet and a seat at the table.
      </PageHeader>

      {"error" in agents ? (
        <PageError title="Couldn't load your agents" error={agents.error} />
      ) : crew.length === 0 ? (
        <EmptyState icon={UtensilsIcon} title="The kitchen is empty">
          Adopt your first agent: it gets its own API key and MCP config. Then give it a diet that says what it may
          spend on.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {crew.map(({ agent, mood }) => (
            <AgentCard key={agent.id} agent={agent} mood={mood} />
          ))}
        </div>
      )}
    </div>
  );
}

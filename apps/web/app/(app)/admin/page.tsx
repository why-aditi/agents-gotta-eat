// Admin dashboard: journals, accounts, reconciliation and LLM usage (read-only), and demo recordings, one tab per
// `?tab=`.
// Only the active tab's data is loaded. Middleware already sends non-admins away; this checks again.
import { AdminAccountList, AdminJournalList, LlmUsage, ReconcileReport } from "@gottaeat/schemas";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { ADMIN_FALLBACK_PATH, isAdmin } from "@/lib/admin-access";
import { apiFetch, getMe } from "@/lib/api";
import { RecordingList } from "@gottaeat/schemas";
import { cn } from "@/lib/utils";
import { PageError } from "../_lib/page-error";
import { AccountsGrid } from "./accounts-grid";
import { DemoPanel } from "./demo-panel";
import { ADMIN_TABS, type AdminTab, parseTab } from "./format";
import { JournalsGrid } from "./journals-grid";
import { LlmUsagePanel } from "./llm-usage";
import { ReconcileCards } from "./reconcile-cards";

export const metadata = { title: "Admin · Agents Gotta Eat" };

async function TabContent({ tab }: { tab: AdminTab }) {
  try {
    switch (tab) {
      case "journals": {
        const page = await apiFetch(AdminJournalList, "/v1/admin/journals?limit=100");
        return <JournalsGrid initial={page.items} nextCursor={page.nextCursor} />;
      }
      case "accounts": {
        const { accounts } = await apiFetch(AdminAccountList, "/v1/admin/accounts");
        return <AccountsGrid accounts={accounts} />;
      }
      case "reconcile":
        return <ReconcileCards report={await apiFetch(ReconcileReport, "/v1/admin/reconcile")} />;
      case "llm":
        return <LlmUsagePanel usage={await apiFetch(LlmUsage, "/v1/admin/llm-usage")} />;
      case "demo": {
        const { recordings } = await apiFetch(RecordingList, "/v1/admin/recordings");
        return <DemoPanel recordings={recordings} />;
      }
    }
  } catch (err) {
    // Next's own control-flow errors (dynamic rendering, redirects) must propagate.
    unstable_rethrow(err);
    return <PageError title="Couldn't load this tab" error={err} />;
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const tab = parseTab((await searchParams).tab);
  let roles: string[];
  try {
    roles = (await getMe()).roles;
  } catch (err) {
    unstable_rethrow(err);
    return <PageError title="Couldn't load the admin dashboard" error={err} />;
  }
  if (!isAdmin(roles)) redirect(ADMIN_FALLBACK_PATH);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          The full ledger, its reconciliation and LLM usage (read-only), and the demo recordings.
        </p>
      </div>
      <nav aria-label="Admin sections" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-[3px]">
        {ADMIN_TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
              t.id === tab
                ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <TabContent tab={tab} />
    </div>
  );
}

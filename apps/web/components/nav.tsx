// ui-02: the signed-in shell. Desktop: a dark sidebar with the pages, the wallet balance and the account menu.
// Phones: a slim top bar and a bottom tab bar. Server component: the pending count, the admin flag and the balance
// are fetched here, each best effort.
import { SpendRequestList, Wallet } from "@gottaeat/schemas";
import { CoinsIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/app/money";
import { NavLinks, TabBar } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import { isAdmin } from "@/lib/admin-access";
import { apiFetch, getMe } from "@/lib/api";

async function pendingCount(): Promise<number | null> {
  try {
    const { spendRequests } = await apiFetch(SpendRequestList, "/v1/approvals?status=pending");
    return spendRequests.length;
  } catch {
    // The badge is a hint; the approvals page shows the real error.
    return null;
  }
}

async function adminUser(): Promise<boolean> {
  try {
    return isAdmin((await getMe()).roles);
  } catch {
    // Hide the link when roles can't be read; the api enforces the role anyway.
    return false;
  }
}

async function balance(): Promise<number | null> {
  try {
    return (await apiFetch(Wallet, "/v1/wallet")).balanceCents;
  } catch {
    // The wallet page shows the real error.
    return null;
  }
}

function Logo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={className}>
      <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400">
        <CoinsIcon className="size-[1.1rem]" aria-hidden />
      </span>
      <span className="font-semibold tracking-tight">Agents Gotta Eat</span>
    </Link>
  );
}

export async function AppShell({
  user,
  children,
}: {
  user: { name: string | null; email: string };
  children: ReactNode;
}) {
  const [count, admin, cents] = await Promise.all([pendingCount(), adminUser(), balance()]);
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="dark fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
        <Logo className="mb-6 flex items-center gap-2.5 px-2 text-sidebar-accent-foreground" />
        <NavLinks pendingCount={count} isAdmin={admin} />
        <div className="mt-auto space-y-3">
          {cents !== null && (
            <Link
              href="/wallet"
              className="block rounded-2xl border border-sidebar-border bg-gradient-to-br from-emerald-400/10 to-transparent p-4 transition-colors hover:border-emerald-400/30"
            >
              <span className="text-xs text-sidebar-foreground/70">Wallet balance</span>
              <Money cents={cents} className="mt-1 block text-xl font-semibold text-sidebar-accent-foreground" />
            </Link>
          )}
          <UserMenu
            name={user.name}
            email={user.email}
            className="h-10 w-full max-w-none justify-start rounded-xl px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_span]:inline"
          />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Logo className="flex items-center gap-2" />
        <UserMenu name={user.name} email={user.email} />
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12">{children}</div>
      <TabBar pendingCount={count} isAdmin={admin} />
    </div>
  );
}

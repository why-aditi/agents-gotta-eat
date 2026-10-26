// Top bar for signed-in pages. Server component: the pending count is fetched on the server.
import { SpendRequestList } from "@gottaeat/schemas";
import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import { apiFetch } from "@/lib/api";

async function pendingCount(): Promise<number | null> {
  try {
    const { spendRequests } = await apiFetch(SpendRequestList, "/v1/approvals?status=pending");
    return spendRequests.length;
  } catch {
    // The badge is a hint; the approvals page shows the real error.
    return null;
  }
}

export async function Nav({ user }: { user: { name: string | null; email: string } }) {
  const count = await pendingCount();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <Link href="/agents" className="shrink-0 font-semibold tracking-tight">
          <span className="sm:hidden">AGE</span>
          <span className="hidden sm:inline">Agents Gotta Eat</span>
        </Link>
        <NavLinks pendingCount={count} />
        <div className="ml-auto shrink-0">
          <UserMenu name={user.name} email={user.email} />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/agents", label: "Agents" },
  { href: "/approvals", label: "Approvals" },
  { href: "/wallet", label: "Wallet" },
] as const;

export function NavLinks({ pendingCount }: { pendingCount: number | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {href === "/approvals" && pendingCount !== null && pendingCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 tabular-nums" aria-label={`${pendingCount} pending`}>
                {pendingCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

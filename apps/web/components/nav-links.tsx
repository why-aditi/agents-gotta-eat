"use client";

// ui-02: the app's navigation, twice: a vertical list in the desktop sidebar and a bottom tab bar on phones. Both
// mark the current page and show how many spends wait for the owner.
import type { ArenaEvent } from "@gottaeat/schemas";
import {
  BotIcon,
  EllipsisIcon,
  HouseIcon,
  InboxIcon,
  type LucideIcon,
  RadioIcon,
  ShieldIcon,
  TrophyIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LINKS: NavItem[] = [
  { href: "/home", label: "Today", icon: HouseIcon },
  { href: "/approvals", label: "Approvals", icon: InboxIcon },
  { href: "/agents", label: "Agents", icon: BotIcon },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
  { href: "/bounties", label: "Bounties", icon: TrophyIcon },
  { href: "/arena", label: "Arena", icon: RadioIcon },
];

const ADMIN_LINK: NavItem = { href: "/admin", label: "Admin", icon: ShieldIcon };

// The first four sit in the phone tab bar; the rest go under More.
const TAB_COUNT = 4;

// The approvals badge changes when a spend waits for the owner or an approval is decided.
const approvalsChanged = (e: ArenaEvent) => e.type === "spend.decided" || e.type === "approval.decided";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PendingBadge({ count, className }: { count: number | null; className?: string }) {
  if (count === null || count === 0) return null;
  return (
    <span
      aria-label={`${count} pending`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-snack px-1.5 text-[0.7rem] font-semibold text-zinc-950 tabular-nums",
        className,
      )}
    >
      <span aria-hidden>{count}</span>
      <span className="sr-only"> {count} pending</span>
    </span>
  );
}

export function NavLinks({ pendingCount, isAdmin = false }: { pendingCount: number | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      <LiveRefresh when={approvalsChanged} fallbackMs={0} />
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon
              className={cn("size-[1.1rem]", active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100")}
              aria-hidden
            />
            {label}
            {href === "/approvals" && <PendingBadge count={pendingCount} className="ml-auto" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ pendingCount, isAdmin = false }: { pendingCount: number | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = LINKS.slice(0, TAB_COUNT);
  const more = isAdmin ? [...LINKS.slice(TAB_COUNT), ADMIN_LINK] : LINKS.slice(TAB_COUNT);
  const moreActive = more.some((l) => isActive(pathname, l.href));
  const tabClass = (active: boolean) =>
    cn(
      "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground",
    );
  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
            <Icon className="size-5" aria-hidden />
            {label}
            {href === "/approvals" && <PendingBadge count={pendingCount} className="absolute top-1 left-1/2 ml-1.5" />}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger className={tabClass(moreActive)} aria-label="More pages">
          <EllipsisIcon className="size-5" aria-hidden />
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-44">
          {more.map(({ href, label, icon: Icon }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href}>
                <Icon aria-hidden /> {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

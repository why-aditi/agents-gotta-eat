// ui-02: the top of every app page: a title, one line on what the page is for, and its main action.
import type { ReactNode } from "react";

export function PageHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {children && <p className="max-w-2xl text-sm text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}

// The recorded run's PayPal sandbox transactions, grouped by bounty. Authorizations and captures link to the
// sandbox activity page; orders have no stable sandbox URL, so their ids are shown as text.
import { ExternalLinkIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MoneyLink, MoneyLinkKind } from "@/lib/demo-schemas";
import { sandboxUrl } from "@/lib/demo-view";

const KIND_LABEL: Record<MoneyLinkKind, string> = {
  order: "Order",
  authorization: "Authorization (escrow hold)",
  capture: "Capture (payment)",
};

export function MoneyPanel({ links }: { links: MoneyLink[] | null }) {
  const groups = new Map<string, { title: string; links: MoneyLink[] }>();
  for (const link of links ?? []) {
    const group = groups.get(link.bountyId) ?? { title: link.bountyTitle, links: [] };
    group.links.push(link);
    groups.set(link.bountyId, group);
  }
  return (
    <Card data-testid="money-panel">
      <CardHeader>
        <CardTitle>Money</CardTitle>
        <CardDescription>The PayPal sandbox transactions behind this run&apos;s escrowed bounties.</CardDescription>
      </CardHeader>
      <CardContent>
        {links === null ? (
          <p className="text-sm text-muted-foreground">The transaction list couldn&apos;t be loaded.</p>
        ) : groups.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            No PayPal transactions in this run: its bounties were funded with dev credit.
          </p>
        ) : (
          <ul className="space-y-4">
            {[...groups].map(([bountyId, group]) => (
              <li key={bountyId} className="space-y-1">
                <p className="text-sm font-medium break-words">{group.title}</p>
                <ul className="space-y-1 text-sm">
                  {group.links.map((link) => {
                    const url = sandboxUrl(link.url);
                    return (
                      <li key={`${link.kind}:${link.paypalId}`} className="flex flex-wrap gap-x-2">
                        <span className="text-muted-foreground">{KIND_LABEL[link.kind]}</span>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-2 hover:underline"
                          >
                            {link.paypalId}
                            <ExternalLinkIcon className="size-3" aria-hidden />
                            <span className="sr-only">(opens PayPal sandbox)</span>
                          </a>
                        ) : (
                          <span className="font-mono text-xs break-all">{link.paypalId}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

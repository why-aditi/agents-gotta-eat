"use client";

// Every mandate version, newest first. The highest confirmed version is the active one; unconfirmed versions can
// be confirmed from here (confirming an older one only activates it when nothing newer is confirmed).
import type { Mandate } from "@gottaeat/schemas";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "../../_lib/format";
import { confirmMandate } from "./actions";
import { activeVersion, describeRules } from "./describe-rules";

export function MandateVersions({ agentId, mandates }: { agentId: string; mandates: Mandate[] }) {
  const [pending, startTransition] = useTransition();
  const active = activeVersion(mandates);

  function confirm(version: number) {
    startTransition(async () => {
      const result = await confirmMandate(agentId, version);
      if (result.ok) toast.success(`Version ${version} confirmed.`);
      else toast.error(result.message);
    });
  }

  if (mandates.length === 0) {
    return <p className="text-sm text-muted-foreground">No versions yet. Save the form to create version 1.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mandates.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <div className="font-medium" title={describeRules(m.rules).join("\n")}>
                v{m.version}
              </div>
              <div className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {m.confirmedAt ? (
                  <Badge variant="secondary">Confirmed</Badge>
                ) : (
                  <Badge variant="outline">Unconfirmed</Badge>
                )}
                {m.version === active ? <Badge>Active</Badge> : null}
              </div>
              {m.confirmedAt ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pending}
                  onClick={() => confirm(m.version)}
                  aria-label={`Confirm version ${m.version}`}
                >
                  Confirm
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

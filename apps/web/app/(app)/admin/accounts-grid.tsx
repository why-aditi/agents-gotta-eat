"use client";

// Every ledger account with its balance from the entries. Wallet accounts show the cached balance too, and a
// wallet whose cache disagrees with the ledger is highlighted.
import type { AdminAccount } from "@gottaeat/schemas";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/data-grid";
import { accountMismatch, centsCell } from "./format";

const COLUMNS: ColDef<AdminAccount>[] = [
  { field: "id", headerName: "Account", minWidth: 260, cellClass: "font-mono text-xs" },
  { field: "type", headerName: "Type", maxWidth: 120 },
  { field: "ownerId", headerName: "Owner", minWidth: 200, valueFormatter: (p) => p.value ?? "—" },
  {
    field: "balanceCents",
    headerName: "Balance",
    valueFormatter: centsCell,
    type: "rightAligned",
    cellClass: ["ag-right-aligned-cell", "tabular-nums"],
    maxWidth: 150,
  },
  {
    field: "cachedBalanceCents",
    headerName: "Cached balance",
    valueFormatter: (p) => (p.value === null || p.value === undefined ? "—" : centsCell(p)),
    type: "rightAligned",
    cellClass: ["ag-right-aligned-cell", "tabular-nums"],
    maxWidth: 160,
  },
  {
    colId: "status",
    headerName: "Cache",
    valueGetter: (p) =>
      !p.data || p.data.cachedBalanceCents === null ? "" : accountMismatch(p.data) ? "mismatch" : "ok",
    maxWidth: 120,
  },
];

// One class name (AG Grid adds it with classList); styled in globals.css.
const ROW_CLASS_RULES = {
  "admin-row-mismatch": (p: { data: AdminAccount | undefined }) => p.data !== undefined && accountMismatch(p.data),
};

export function AccountsGrid({ accounts }: { accounts: AdminAccount[] }) {
  const mismatches = accounts.filter(accountMismatch).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {accounts.length} account{accounts.length === 1 ? "" : "s"}.{" "}
        {mismatches === 0 ? (
          "Every wallet cache matches the ledger."
        ) : (
          <span className="font-medium text-destructive">
            {mismatches === 1 ? "1 wallet cache disagrees" : `${mismatches} wallet caches disagree`} with the ledger.
          </span>
        )}
      </p>
      <DataGrid
        rows={accounts}
        columns={COLUMNS}
        getRowId={(a) => a.id}
        ariaLabel="Accounts"
        rowClassRules={ROW_CLASS_RULES}
        emptyMessage="No accounts yet."
      />
    </div>
  );
}

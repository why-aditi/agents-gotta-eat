"use client";

// AG Grid (Community, MIT) with the app's colours. Modules are registered once per page load. The Quartz theme
// reads the shadcn tokens, and its light/dark mode follows next-themes for the browser-native bits (scrollbars,
// inputs).
import {
  AllCommunityModule,
  type CellKeyDownEvent,
  type ColDef,
  ModuleRegistry,
  type RowClickedEvent,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useTheme } from "next-themes";

ModuleRegistry.registerModules([AllCommunityModule]);

const shared = {
  backgroundColor: "var(--card)",
  foregroundColor: "var(--card-foreground)",
  headerBackgroundColor: "var(--muted)",
  borderColor: "var(--border)",
  accentColor: "var(--ring)",
  fontFamily: "inherit",
  fontSize: 13,
  headerFontWeight: 600,
  wrapperBorderRadius: 8,
} as const;

export const gridTheme = themeQuartz
  .withParams({ ...shared, browserColorScheme: "light" }, "light")
  .withParams({ ...shared, browserColorScheme: "dark" }, "dark");

const AUTO_HEIGHT_ROWS = 10;
const EMPTY_HEIGHT_PX = 200;

export interface DataGridProps<T> {
  rows: T[];
  columns: ColDef<T>[];
  getRowId: (row: T) => string;
  ariaLabel: string;
  onRowClicked?: (row: T) => void;
  rowClassRules?: Record<string, (params: { data: T | undefined }) => boolean>;
  // "auto" always grows with the rows; a number is the height in px (with scrolling) once there are more than
  // AUTO_HEIGHT_ROWS rows.
  height?: "auto" | number;
  emptyMessage?: string;
}

export function DataGrid<T>({
  rows,
  columns,
  getRowId,
  ariaLabel,
  onRowClicked,
  rowClassRules,
  height = 480,
  emptyMessage = "Nothing here yet.",
}: DataGridProps<T>) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  // A short table grows to fit instead of leaving an empty fixed-height box; an empty one keeps room for its
  // message.
  const auto = height === "auto" || (rows.length > 0 && rows.length <= AUTO_HEIGHT_ROWS);
  const fixed = rows.length === 0 ? EMPTY_HEIGHT_PX : height;
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className="ag-theme-mode w-full"
      data-ag-theme-mode={mode}
      style={auto ? undefined : { height: fixed }}
    >
      <AgGridReact<T>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={{ sortable: true, resizable: true, filter: false, minWidth: 90 }}
        getRowId={(p) => getRowId(p.data)}
        domLayout={auto ? "autoHeight" : "normal"}
        rowClassRules={rowClassRules}
        onRowClicked={onRowClicked ? (e: RowClickedEvent<T>) => e.data && onRowClicked(e.data) : undefined}
        // Keyboard users open a row with Enter on any of its cells.
        onCellKeyDown={
          onRowClicked
            ? (e: CellKeyDownEvent<T>) => {
                if ((e.event as KeyboardEvent | null)?.key === "Enter" && e.data) onRowClicked(e.data);
              }
            : undefined
        }
        rowStyle={onRowClicked ? { cursor: "pointer" } : undefined}
        overlayNoRowsTemplate={`<span class="text-sm">${escapeHtml(emptyMessage)}</span>`}
        suppressCellFocus={!onRowClicked}
        autoSizeStrategy={{ type: "fitGridWidth" }}
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

import { Badge } from "@outbound/ui/components/ui/badge";
import { Button } from "@outbound/ui/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@outbound/ui/components/ui/empty";
import { Skeleton } from "@outbound/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@outbound/ui/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { paths } from "@/config/paths";
import { DeleteExportDialog } from "@/features/exports/components/delete-export-dialog";
import { ExportsEmpty } from "@/features/exports/components/exports-empty";
import { RecreateExportButton } from "@/features/exports/components/recreate-export-button";
import type { ExportsListResponse } from "@/features/exports/schemas/exports-list-response";
import type { SavedExport } from "@/features/exports/schemas/saved-export";
import { formatStartAt } from "@/features/trip-planner/utils/format-start-at";

export interface ExportsTableProps {
  readonly data: ExportsListResponse | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly pagination: PaginationState;
  readonly onPaginationChange: (next: PaginationState) => void;
  readonly onRetry: () => void;
}

const SKELETON_ROWS = 10;

const MODE_LABEL: Record<SavedExport["mode"], string> = {
  "multi-page": "Multi-page",
  "single-page": "Single-page",
};

function RouteCell({ row }: CellContext<SavedExport, unknown>): React.ReactElement {
  const record = row.original;
  // ``trip_id === null`` means the original trip was deleted (BE ``on_delete=
  // SET_NULL``); show inert text + a "Deleted" badge so the driver can still
  // read the route summary but can't follow a dead link.
  if (record.trip_id === null) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="max-w-[180px] truncate" title={record.trip_current_label}>
          {record.trip_current_label}
        </span>
        <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
        <span className="max-w-[180px] truncate" title={record.trip_pickup_label}>
          {record.trip_pickup_label}
        </span>
        <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
        <span className="max-w-[180px] truncate" title={record.trip_dropoff_label}>
          {record.trip_dropoff_label}
        </span>
        <Badge variant="secondary" className="ml-2 shrink-0">
          Deleted
        </Badge>
      </div>
    );
  }
  return (
    <Link
      to={paths.tripsDetail(record.trip_id)}
      aria-label={`Open trip ${record.trip_current_label} to ${record.trip_dropoff_label}`}
      className="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 items-center gap-1.5 rounded-sm text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <span className="max-w-[180px] truncate" title={record.trip_current_label}>
        {record.trip_current_label}
      </span>
      <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
      <span className="max-w-[180px] truncate" title={record.trip_pickup_label}>
        {record.trip_pickup_label}
      </span>
      <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
      <span className="max-w-[180px] truncate" title={record.trip_dropoff_label}>
        {record.trip_dropoff_label}
      </span>
    </Link>
  );
}

function ModeCell({ row }: CellContext<SavedExport, unknown>): React.ReactElement {
  return (
    <Badge variant="outline" className="font-normal">
      {MODE_LABEL[row.original.mode]}
    </Badge>
  );
}

function SheetCountCell({ row }: CellContext<SavedExport, unknown>): React.ReactElement {
  const sheets = row.original.sheet_count;
  return (
    <span className="text-sm tabular-nums">
      {sheets}
      <span className="sr-only"> {sheets === 1 ? "sheet" : "sheets"}</span>
    </span>
  );
}

function ExportedAtCell({ row }: CellContext<SavedExport, unknown>): React.ReactElement {
  return (
    <span className="text-muted-foreground text-sm">{formatStartAt(row.original.created_at)}</span>
  );
}

function ActionsCell({ row }: CellContext<SavedExport, unknown>): React.ReactElement {
  return (
    <div className="flex items-center justify-end gap-1">
      <RecreateExportButton record={row.original} />
      <DeleteExportDialog
        exportId={row.original.id}
        routeLabel={`${row.original.trip_current_label} → ${row.original.trip_dropoff_label}`}
      />
    </div>
  );
}

function ActionsHeader(): React.ReactElement {
  return <span className="sr-only">Actions</span>;
}

const COLUMNS: ColumnDef<SavedExport>[] = [
  { id: "route", header: "Route", cell: RouteCell },
  { id: "mode", header: "Mode", cell: ModeCell },
  { id: "sheets", header: "Sheets", cell: SheetCountCell },
  { id: "exported", header: "Exported", cell: ExportedAtCell },
  { id: "actions", header: ActionsHeader, cell: ActionsCell },
];

export function ExportsTable({
  data,
  isLoading,
  isError,
  pagination,
  onPaginationChange,
  onRetry,
}: ExportsTableProps): React.ReactElement {
  const rows = data?.results ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.count / pagination.pageSize)) : -1;

  // eslint-disable-next-line react-hooks/incompatible-library -- upstream: see https://react.dev/learn/react-compiler
  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      onPaginationChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
  });

  if (isError) {
    return (
      <Empty className="border-destructive/40">
        <EmptyHeader>
          <EmptyTitle>Couldn&rsquo;t load exports.</EmptyTitle>
          <EmptyDescription>Check your connection and try again.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </Empty>
    );
  }

  if (!isLoading && rows.length === 0) {
    return <ExportsEmpty />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} scope="col">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    {COLUMNS.map((column) => (
                      <TableCell key={`${idx}-${column.id ?? "col"}`}>
                        <Skeleton className="h-4 w-full max-w-[180px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      {pageCount > 0 ? (
        <DataTablePagination
          pageIndex={pagination.pageIndex}
          pageCount={pageCount}
          onPrevious={() => {
            table.previousPage();
          }}
          onNext={() => {
            table.nextPage();
          }}
        />
      ) : null}
    </div>
  );
}

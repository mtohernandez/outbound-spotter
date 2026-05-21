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
import { DeleteTripDialog } from "@/features/saved-trips/components/delete-trip-dialog";
import { SavedTripsEmpty } from "@/features/saved-trips/components/saved-trips-empty";
import type { SavedTrip } from "@/features/saved-trips/schemas/saved-trip";
import type { TripsListResponse } from "@/features/saved-trips/schemas/trips-list-response";
import { formatDistance } from "@/features/trip-planner/utils/format-distance";
import { formatStartAt } from "@/features/trip-planner/utils/format-start-at";

export interface SavedTripsTableProps {
  readonly data: TripsListResponse | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly pagination: PaginationState;
  readonly onPaginationChange: (next: PaginationState) => void;
  readonly onRetry: () => void;
}

const SKELETON_ROWS = 10;

// Cells are hoisted as named function components so React can stable-identify
// them across renders (react/no-unstable-nested-components). They're stateless
// renderers — no hooks, no internal state.

function RouteCell({ row }: CellContext<SavedTrip, unknown>): React.ReactElement {
  // Real <a> as the navigation primitive (a11y review CRITICAL-1/2):
  // <tr role="link"> + hand-rolled keyboard handlers are an AT anti-pattern
  // because NVDA/JAWS in browse mode never see the keydown. A <Link> renders
  // as a native anchor that AT activates with Enter natively in both browse
  // and application modes.
  return (
    <Link
      to={paths.tripsDetail(row.original.id)}
      aria-label={`Open trip ${row.original.current_label} to ${row.original.dropoff_label}`}
      className="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 items-center gap-1.5 rounded-sm text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <span className="max-w-[180px] truncate" title={row.original.current_label}>
        {row.original.current_label}
      </span>
      <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
      <span className="max-w-[180px] truncate" title={row.original.pickup_label}>
        {row.original.pickup_label}
      </span>
      <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-hidden />
      <span className="max-w-[180px] truncate" title={row.original.dropoff_label}>
        {row.original.dropoff_label}
      </span>
    </Link>
  );
}

function DistanceCell({ row }: CellContext<SavedTrip, unknown>): React.ReactElement {
  return (
    <span className="text-sm tabular-nums">
      {formatDistance(row.original.route_summary.distance_mi)}
    </span>
  );
}

function DaysCell({ row }: CellContext<SavedTrip, unknown>): React.ReactElement {
  // sr-only suffix so screen readers announce "3 days" / "1 day" instead of a bare integer.
  const days = row.original.days_count;
  return (
    <span className="text-sm tabular-nums">
      {days}
      <span className="sr-only"> {days === 1 ? "day" : "days"}</span>
    </span>
  );
}

function DepartsCell({ row }: CellContext<SavedTrip, unknown>): React.ReactElement {
  return (
    <span className="text-muted-foreground text-sm">{formatStartAt(row.original.start_at)}</span>
  );
}

function ActionsCell({ row }: CellContext<SavedTrip, unknown>): React.ReactElement {
  return (
    <DeleteTripDialog
      tripId={row.original.id}
      routeLabel={`${row.original.current_label} → ${row.original.dropoff_label}`}
    />
  );
}

function ActionsHeader(): React.ReactElement {
  return <span className="sr-only">Actions</span>;
}

// Columns themselves are stable across renders — defined at module scope.
const COLUMNS: ColumnDef<SavedTrip>[] = [
  { id: "route", header: "Route", cell: RouteCell },
  { id: "distance", header: "Distance", cell: DistanceCell },
  { id: "days", header: "Days", cell: DaysCell },
  { id: "departs", header: "Departs", cell: DepartsCell },
  { id: "actions", header: ActionsHeader, cell: ActionsCell },
];

export function SavedTripsTable({
  data,
  isLoading,
  isError,
  pagination,
  onPaginationChange,
  onRetry,
}: SavedTripsTableProps): React.ReactElement {
  const rows = data?.results ?? [];
  // pageCount = -1 while loading so TanStack treats it as "unknown" rather than
  // "no pages" (performance review m1). Pagination footer is gated on pageCount > 0
  // so the chrome doesn't appear with stale numbers during the first paint.
  const pageCount = data ? Math.max(1, Math.ceil(data.count / pagination.pageSize)) : -1;

  // React Compiler can't safely memoize TanStack Table's hooks (their return
  // functions intentionally capture mutable state). The skip warning is the
  // upstream-recommended behavior — silence it here so lint-staged stays clean.
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
          <EmptyTitle>Couldn&rsquo;t load trips.</EmptyTitle>
          <EmptyDescription>Check your connection and try again.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </Empty>
    );
  }

  if (!isLoading && rows.length === 0) {
    return <SavedTripsEmpty />;
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

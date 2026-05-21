import { useState, type CSSProperties } from "react";

import { useTripList } from "@/features/saved-trips/api/list-trips";
import { SavedTripsTable } from "@/features/saved-trips/components/saved-trips-table";

const PAGE_SIZE = 50;

export function TripsHistoryRoute(): React.ReactElement {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const query = useTripList({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
      style={{ "--container-max": "72rem" } as CSSProperties}
    >
      <div className="mx-auto flex w-full max-w-(--container-max) flex-col gap-4">
        <header>
          <h1 className="font-display text-2xl tracking-tight">Saved trips</h1>
          <p className="text-muted-foreground text-sm">
            Open a trip to revisit the route and daily logs.
          </p>
        </header>
        <SavedTripsTable
          data={query.data}
          isLoading={query.isPending}
          isError={query.isError}
          pagination={pagination}
          onPaginationChange={setPagination}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    </div>
  );
}

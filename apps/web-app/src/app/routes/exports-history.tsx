import { useState, type CSSProperties } from "react";

import { useExportsList } from "@/features/exports/api/list-exports";
import { ExportsTable } from "@/features/exports/components/exports-table";

const PAGE_SIZE = 50;

export function ExportsHistoryRoute(): React.ReactElement {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const query = useExportsList({
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
          <h1 className="font-display text-2xl tracking-tight">Exports</h1>
          <p className="text-muted-foreground text-sm">
            Re-download a PDF you exported earlier, or remove the record from history. PDFs on disk
            are never affected.
          </p>
        </header>
        <ExportsTable
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

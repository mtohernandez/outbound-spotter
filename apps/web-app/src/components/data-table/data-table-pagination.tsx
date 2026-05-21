import { Button } from "@outbound/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DataTablePaginationProps {
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

/**
 * Shared Previous/Next pagination shell. Lifted from
 * ``features/saved-trips/components/saved-trips-pagination.tsx`` for the
 * spec-10 phase-3 ``features/exports/`` consumer; the table column shapes
 * stay per-feature (the "fourth-duplicate" rule from
 * ``context/code-standards.md``).
 */
export function DataTablePagination({
  pageIndex,
  pageCount,
  onPrevious,
  onNext,
}: DataTablePaginationProps): React.ReactElement {
  const displayPage = pageCount === 0 ? 0 : pageIndex + 1;
  const displayTotal = Math.max(pageCount, 1);
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3">
      {/* aria-atomic + persistent wrapper so the SR re-announces the whole
          "Page X of Y" string on change, not just the changed digit. Wrapping
          element never unmounts (the inner text node is updated in place). */}
      <div className="text-muted-foreground text-sm" aria-live="polite" aria-atomic="true">
        Page {displayPage} of {displayTotal}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={pageIndex === 0}
          aria-label="Previous page"
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={pageIndex + 1 >= pageCount}
          aria-label="Next page"
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

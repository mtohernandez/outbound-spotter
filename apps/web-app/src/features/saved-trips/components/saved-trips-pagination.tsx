import { Button } from "@outbound/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface SavedTripsPaginationProps {
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

export function SavedTripsPagination({
  pageIndex,
  pageCount,
  onPrevious,
  onNext,
}: SavedTripsPaginationProps): React.ReactElement {
  const displayPage = pageCount === 0 ? 0 : pageIndex + 1;
  const displayTotal = Math.max(pageCount, 1);
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Page {displayPage} of {displayTotal}
      </p>
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

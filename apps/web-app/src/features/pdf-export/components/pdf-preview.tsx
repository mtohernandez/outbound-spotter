import { Button } from "@outbound/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ExportMode } from "@/features/pdf-export/types/export-mode";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface Props {
  readonly days: readonly LogDay[];
  readonly mode: ExportMode;
}

const PREVIEW_HEIGHT_PX = 260;

export function PdfPreview({ days, mode }: Props): React.ReactElement | null {
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Memoize the slice so the effect's dependency stays referentially stable
  // across renders that don't change `days`/`mode`/`page` (perf MINOR-1).
  const visibleDays = useMemo(
    () => (mode === "single-page" ? days : days.slice(page, page + 1)),
    [days, mode, page],
  );

  // Mirror what renderTripPdf will commit: clone the live SVGs the user
  // already sees in the Log Sheets tab and render them inline at scaled
  // size. No preview/output drift because both surfaces read the same DOM.
  useEffect(() => {
    const host = containerRef.current;
    if (host === null) return;
    host.replaceChildren();
    for (const day of visibleDays) {
      const live = document.getElementById(`daily-log-sheet-${day.id}`);
      if (!(live instanceof SVGSVGElement)) continue;
      const clone = live.cloneNode(true) as SVGSVGElement;
      clone.removeAttribute("id");
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      clone.style.cssText = "display:block;width:100%;height:auto;max-width:100%;min-width:0;";
      clone.setAttribute("role", "img");
      clone.setAttribute("aria-label", `Daily log sheet for ${day.date}`);
      host.appendChild(clone);
    }
  }, [visibleDays]);

  if (days.length === 0) return null;

  const isMulti = mode === "multi-page";
  const canPrev = isMulti && page > 0;
  const canNext = isMulti && page < days.length - 1;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>Preview</span>
        {isMulti ? (
          <span>
            Page {page + 1} of {days.length}
          </span>
        ) : (
          <span>Single page · {days.length} sheets stacked</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="bg-card border-border max-h-(--preview-h) w-full min-w-0 overflow-x-hidden overflow-y-auto rounded-md border p-2"
        style={{ "--preview-h": `${PREVIEW_HEIGHT_PX.toString()}px` } as React.CSSProperties}
      />
      {isMulti ? (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={!canPrev}
            onClick={() => {
              setPage((current) => Math.max(0, current - 1));
            }}
          >
            <ChevronLeft data-icon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={!canNext}
            onClick={() => {
              setPage((current) => Math.min(days.length - 1, current + 1));
            }}
          >
            <ChevronRight data-icon aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { Button } from "@outbound/ui/components/ui/button";
import { FileDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { ExportDialog } from "@/features/pdf-export/components/export-dialog";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface ExportButtonProps {
  readonly tripId: string;
  readonly days: readonly LogDay[];
  readonly disabled?: boolean;
}

export function ExportButton({ tripId, days, disabled }: ExportButtonProps): React.ReactElement {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const hasDays = days.length > 0;

  // Radix Dialog only restores focus to a DialogTrigger it owns; we control
  // the open state externally so we drive the focus return ourselves on the
  // open → closed edge (WCAG 2.4.3 Focus Order).
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      // requestAnimationFrame defers the focus call until after Radix has
      // unmounted the dialog content, otherwise the focus lands inside the
      // closing tree and bounces.
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        disabled={disabled === true || !hasDays}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="export-pdf-trigger"
      >
        <FileDown data-icon aria-hidden="true" />
        Export PDF
      </Button>
      <ExportDialog tripId={tripId} days={days} open={open} onOpenChange={handleOpenChange} />
    </>
  );
}

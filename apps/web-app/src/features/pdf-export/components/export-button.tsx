import { Button } from "@outbound/ui/components/ui/button";
import { FileDown } from "lucide-react";
import { useState } from "react";

import { ExportDialog } from "@/features/pdf-export/components/export-dialog";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface ExportButtonProps {
  readonly tripId: string;
  readonly days: readonly LogDay[];
  readonly disabled?: boolean;
}

export function ExportButton({ tripId, days, disabled }: ExportButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const hasDays = days.length > 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        disabled={disabled === true || !hasDays}
        aria-haspopup="dialog"
        data-testid="export-pdf-trigger"
      >
        <FileDown data-icon aria-hidden="true" />
        Export PDF
      </Button>
      <ExportDialog tripId={tripId} days={days} open={open} onOpenChange={setOpen} />
    </>
  );
}

import { Button } from "@outbound/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@outbound/ui/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@outbound/ui/components/ui/toggle-group";
import { FileText, Files, Loader2 } from "lucide-react";
import { useState } from "react";

import { useExportPdf } from "@/features/pdf-export/hooks/use-export-pdf";
import {
  EXPORT_MODES,
  type ExportMode,
  isExportMode,
} from "@/features/pdf-export/types/export-mode";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

interface ExportDialogProps {
  readonly tripId: string;
  readonly days: readonly LogDay[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const DEFAULT_MODE: ExportMode = EXPORT_MODES[0];

export function ExportDialog({
  tripId,
  days,
  open,
  onOpenChange,
}: ExportDialogProps): React.ReactElement {
  const [mode, setMode] = useState<ExportMode>(DEFAULT_MODE);
  const { exportPdf, isPending } = useExportPdf({ tripId, days });

  // Reset the toggle whenever the dialog transitions from closed → open via
  // the controlled `onOpenChange` callback, rather than a state-syncing
  // effect (the React 19 ``react-hooks/set-state-in-effect`` rule rightly
  // flags cascading renders).
  const handleOpenChange = (next: boolean): void => {
    if (next && !open) {
      setMode(DEFAULT_MODE);
    }
    onOpenChange(next);
  };

  async function handleExport(): Promise<void> {
    try {
      await exportPdf(mode);
      onOpenChange(false);
    } catch {
      // The hook already surfaced a toast; keep the dialog open so the driver
      // can retry without losing the mode selection.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export PDF</DialogTitle>
          <DialogDescription>
            Pick a layout, then download the §395.8 Daily Log Sheets for this trip. PDFs use
            standard fonts (Helvetica) for cross-reader compatibility.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (isExportMode(value)) {
                setMode(value);
              }
            }}
            variant="outline"
            className="w-full"
            aria-label="Export layout"
          >
            <ToggleGroupItem
              value="multi-page"
              aria-label="Multi-page (one log per page)"
              className="group/toggle flex-1 justify-start gap-2"
            >
              <Files data-icon aria-hidden="true" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">Multi-page</span>
                <span className="text-muted-foreground group-data-[state=on]/toggle:text-accent-foreground/85 text-xs">
                  One log per page
                </span>
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="single-page"
              aria-label="Single-page (all logs stacked)"
              className="group/toggle flex-1 justify-start gap-2"
            >
              <FileText data-icon aria-hidden="true" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">Single-page</span>
                <span className="text-muted-foreground group-data-[state=on]/toggle:text-accent-foreground/85 text-xs">
                  All logs stacked
                </span>
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void handleExport();
            }}
            disabled={isPending}
            aria-busy={isPending}
            data-testid="export-pdf-confirm"
          >
            {isPending ? (
              <Loader2 data-icon className="motion-safe:animate-spin" aria-hidden="true" />
            ) : null}
            {isPending ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useCreateExportRecord } from "@/features/exports/api/create-export";
import { buildPdfFilename } from "@/features/pdf-export/lib/filename";
import type { ExportMode } from "@/features/pdf-export/types/export-mode";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

export interface UseExportPdfInput {
  readonly tripId: string;
  readonly days: readonly LogDay[];
}

export interface UseExportPdfResult {
  readonly exportPdf: (mode: ExportMode) => Promise<void>;
  readonly isPending: boolean;
  readonly error: Error | null;
}

interface ExportPdfRunOptions {
  readonly recreated?: boolean;
  readonly skipAuditRecord?: boolean;
}

/**
 * Render the spec-08 SVGs into a downloadable PDF and (best-effort) record
 * the export server-side.
 *
 * The audit POST to ``/api/exports/`` is **fire-and-forget**: failures
 * are caught by the mutation's ``onError`` (a quiet ``console.warn``);
 * the user never sees a toast about a bookkeeping miss because the PDF
 * has already downloaded by then. The mutation's ``onSuccess`` invalidates
 * the ``["exports","list"]`` query cache so the spec-10 phase-3
 * ``/exports`` history view stays fresh on next mount.
 *
 * **`useState` + `useCallback` over `useActionState`** (spec 10 decision
 * 10 deviation): `useActionState` is tuned for form submissions where the
 * action returns the next state and a derived `isPending` is enough. Here
 * the orchestrator runs imperatively and **rethrows** so
 * ``ExportDialog.handleExport`` can keep the modal open on failure;
 * `useActionState` swallows rejections into its returned state, which
 * would require threading the dialog's keep-open behavior through the
 * tuple. The simpler imperative shape was preferred.
 */
export function useExportPdf({ tripId, days }: UseExportPdfInput): UseExportPdfResult {
  const createExportRecord = useCreateExportRecord();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportPdf = useCallback(
    async (mode: ExportMode, options: ExportPdfRunOptions = {}): Promise<void> => {
      setIsPending(true);
      setError(null);
      try {
        const { renderTripPdf } = await import("@/features/pdf-export/lib/render-trip-pdf");
        const blob = await renderTripPdf({ days, mode });
        const filename = buildPdfFilename(tripId, mode, new Date(), {
          recreated: options.recreated === true,
        });
        triggerBrowserDownload(blob, filename);
        toast.success(`Exported ${filename}`);

        if (options.skipAuditRecord !== true) {
          createExportRecord.mutate(
            { trip_id: tripId, mode },
            {
              onError: (recordError) => {
                // Fire-and-forget — PDF already downloaded, audit row is
                // metadata-only bookkeeping. Don't toast.
                console.warn("Couldn't record export in history.", recordError);
              },
            },
          );
        }
      } catch (caught) {
        const wrapped = caught instanceof Error ? caught : new Error("Export failed");
        setError(wrapped);
        toast.error("Couldn't export PDF. Try again in a moment.");
        throw wrapped;
      } finally {
        setIsPending(false);
      }
    },
    [days, createExportRecord, tripId],
  );

  // The exported function intentionally doesn't expose ``options`` — recreate
  // (phase 3) imports the orchestrator directly and never goes through this
  // hook to avoid creating duplicate audit rows.
  return {
    exportPdf: (mode) => exportPdf(mode),
    isPending,
    error,
  };
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  // Hide the transient anchor from AT (a11y LOW from spec 11c audit).
  link.setAttribute("aria-hidden", "true");
  link.tabIndex = -1;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick to avoid racing the browser's download trigger.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

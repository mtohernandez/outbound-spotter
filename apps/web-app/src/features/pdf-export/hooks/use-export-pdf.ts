import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { buildPdfFilename } from "@/features/pdf-export/lib/filename";
import type { ExportMode } from "@/features/pdf-export/types/export-mode";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";
import { apiFetch } from "@/lib/api-client";

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
 * The audit POST to ``/api/exports/`` is **fire-and-forget**: failure
 * surfaces as ``console.warn`` only, never a toast, because the PDF has
 * already downloaded by then and the audit row is metadata for the spec
 * 10 phase-3 history surface — not load-bearing for the UX. Phase 3
 * replaces the inline ``_writeExportRecord`` helper with the
 * ``useCreateExportRecord`` mutation from ``features/exports/``.
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
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
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
          void writeExportRecord(getToken, { tripId, mode }).then((didWrite) => {
            if (didWrite) {
              void queryClient.invalidateQueries({ queryKey: ["exports", "list"] });
            }
          });
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
    [days, getToken, queryClient, tripId],
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
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick to avoid racing the browser's download trigger.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

interface WriteExportRecordInput {
  readonly tripId: string;
  readonly mode: ExportMode;
}

/**
 * Fire-and-forget POST to ``/api/exports/``. Returns ``true`` on success so
 * the caller can refresh the cached history list.
 *
 * Failures are swallowed with a ``console.warn`` — the PDF has already
 * downloaded and the user shouldn't see a toast about a bookkeeping miss.
 */
async function writeExportRecord(
  getToken: () => Promise<string | null>,
  input: WriteExportRecordInput,
): Promise<boolean> {
  try {
    const token = await getToken();
    await apiFetch("/api/exports/", {
      method: "POST",
      token,
      json: { trip_id: input.tripId, mode: input.mode },
    });
    return true;
  } catch (writeError) {
    // The PDF already downloaded; logging the failure is enough.
    // Phase 3's ``useCreateExportRecord`` replaces this with a TanStack
    // mutation that exposes the same fire-and-forget semantics.
    console.warn("Couldn't record export in history.", writeError);
    return false;
  }
}

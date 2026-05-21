import { useAuth } from "@clerk/react";
import { Button } from "@outbound/ui/components/ui/button";
import { reportableError } from "@outbound/ui/lib/reportable-error";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { SavedExport } from "@/features/exports/schemas/saved-export";
import { DailyLogSheetsStrip } from "@/features/log-sheet/components/daily-log-sheets-strip";
import { buildPdfFilename } from "@/features/pdf-export/lib/filename";
import { isExportMode } from "@/features/pdf-export/types/export-mode";
import { tripPlanSchema, type TripPlan } from "@/features/trip-planner/schemas/trip-plan";
import {
  tripResponseSchema,
  type TripResponse,
} from "@/features/trip-planner/schemas/trip-response";
import { ApiError, apiFetch } from "@/lib/api-client";

interface RecreateExportButtonProps {
  readonly record: SavedExport;
}

interface RecreatePayload {
  readonly trip: TripResponse;
  readonly plan: TripPlan;
  readonly mode: SavedExport["mode"];
}

/**
 * Re-runs the spec-10 phase-2 orchestrator against the same trip with the
 * recorded mode. Does NOT create a new audit row (Recreate is a re-download,
 * not a new logical export).
 *
 * The orchestrator requires the live ``<svg id="daily-log-sheet-${day.id}">``
 * elements in the DOM. On ``/exports`` those sheets aren't mounted, so we
 * mount a ``<DailyLogSheetsStrip>`` off-screen for the duration of the
 * render pass and unmount it once the blob is in the user's downloads
 * folder.
 *
 * Best-effort: the strip renders with empty ``SheetMetadata`` defaults
 * (truck# / carrier / shipping override aren't persisted; spec decision 25).
 * If the original trip has been deleted (``record.trip_id === null``) or
 * the plan returns 404, a toast offers the user the inline Delete CTA.
 */
export function RecreateExportButton({ record }: RecreateExportButtonProps): React.ReactElement {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [payload, setPayload] = useState<RecreatePayload | null>(null);
  // Generation counter — bumped on each Recreate click so a fast double-click
  // doesn't double-fire the export effect.
  const generationRef = useRef(0);

  const tripUnavailable = record.trip_id === null;

  async function handleRecreate(): Promise<void> {
    // ``trip_id === null`` is already gated by the disabled button below; the
    // type guard plus the ``mode`` enum check is enough belt-and-suspenders
    // for future enum drift (e.g. a third mode added BE-side without an FE
    // bump).
    if (record.trip_id === null || !isExportMode(record.mode)) {
      reportableError(new Error("Export mode no longer supported."), "recreate-export");
      return;
    }

    setIsPending(true);
    generationRef.current += 1;
    const generation = generationRef.current;

    try {
      const token = await getToken();
      // Stale-result guard immediately after every async boundary so a fast
      // second click that already advanced the generation drops this run.
      if (generation !== generationRef.current) return;
      const [tripRaw, planRaw] = await Promise.all([
        apiFetch<unknown>(`/api/trips/${record.trip_id}/`, { token }),
        apiFetch<unknown>(`/api/trips/${record.trip_id}/plan/`, { token }),
      ]);
      if (generation !== generationRef.current) return;

      const trip = tripResponseSchema.parse(tripRaw);
      const plan = tripPlanSchema.parse(planRaw);

      // Seed TanStack caches so a subsequent /trips/<id> navigation skips a
      // round-trip.
      queryClient.setQueryData(["trip", record.trip_id], trip);
      queryClient.setQueryData(["trip", record.trip_id, "plan"], plan);

      setPayload({ trip, plan, mode: record.mode });
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : null;
      const message =
        status === 404
          ? "Original trip is no longer available. Remove this record from history."
          : "Couldn't re-export. Try again in a moment.";
      reportableError(new Error(message, { cause: caught }), "recreate-export");
      setIsPending(false);
    }
  }

  useEffect(() => {
    if (payload === null) return;
    const generation = generationRef.current;
    // Wrapped cancel flag because the cleanup callback mutates it
    // asynchronously; a plain ``let`` would be narrowed to ``false`` inside
    // the runner by strict-null TS, defeating the abort check.
    const cancelToken = { aborted: false };

    async function runExport(): Promise<void> {
      try {
        const { renderTripPdf } = await import("@/features/pdf-export/lib/render-trip-pdf");
        if (cancelToken.aborted || generation !== generationRef.current || payload === null) return;
        const blob = await renderTripPdf({ days: payload.plan.days, mode: payload.mode });
        // No abort check here: by the time the orchestrator resolves the blob
        // is already in memory; triggering the download synchronously is
        // cheap and the finally block still skips the post-success state
        // updates if the consumer has unmounted.
        const filename = buildPdfFilename(payload.trip.id, payload.mode, new Date(), {
          recreated: true,
        });
        triggerBrowserDownload(blob, filename);
        toast.success(`Re-exported ${filename}`);
      } catch (caught) {
        reportableError(
          new Error("Couldn't re-export. Try again in a moment.", { cause: caught }),
          "recreate-export",
        );
      } finally {
        if (!cancelToken.aborted) {
          setPayload(null);
          setIsPending(false);
        }
      }
    }

    // Defer one paint so React commits the hidden strip into the DOM before
    // the orchestrator's ``getElementById`` runs.
    const handle = window.requestAnimationFrame(() => {
      void runExport();
    });

    return () => {
      cancelToken.aborted = true;
      window.cancelAnimationFrame(handle);
    };
  }, [payload]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Re-download export for ${record.trip_current_label} → ${record.trip_dropoff_label}`}
        disabled={isPending || tripUnavailable}
        onClick={(event) => {
          event.stopPropagation();
          void handleRecreate();
        }}
      >
        {isPending ? (
          <Loader2 data-icon className="motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw data-icon aria-hidden="true" />
        )}
      </Button>
      {payload === null ? null : (
        <div
          data-testid="recreate-hidden-strip"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: -10000,
            top: -10000,
            width: 1024,
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          <DailyLogSheetsStrip trip={payload.trip} plan={payload.plan} />
        </div>
      )}
    </>
  );
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

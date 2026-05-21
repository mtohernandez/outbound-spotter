import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { savedExportSchema, type SavedExport } from "@/features/exports/schemas/saved-export";
import type { ExportMode } from "@/features/pdf-export/types/export-mode";
import { ApiError, apiFetch } from "@/lib/api-client";

export interface CreateExportRecordInput {
  readonly trip_id: string;
  readonly mode: ExportMode;
}

/**
 * Record an export in the BE audit log. Phase 2's ``useExportPdf`` migrates
 * to this hook in the same diff. The call is intentionally **fire-and-forget**
 * from the caller's perspective: the mutation surfaces ``isError`` so callers
 * may log it, but the PDF has already downloaded by then and the user must
 * never see a toast about a bookkeeping miss.
 */
export function useCreateExportRecord(): UseMutationResult<
  SavedExport,
  Error,
  CreateExportRecordInput
> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<SavedExport, Error, CreateExportRecordInput>({
    mutationFn: async (input) => {
      const token = await getToken();
      const raw = await apiFetch<unknown>("/api/exports/", {
        method: "POST",
        token,
        json: { trip_id: input.trip_id, mode: input.mode },
      });
      const parsed = savedExportSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ApiError(0, {
          detail: "Create-export response shape unexpected",
          issues: parsed.error.issues,
        });
      }
      return parsed.data;
    },
    onSuccess: () => {
      // Prefix invalidation so every cached ["exports","list",limit,offset]
      // page refetches on next mount.
      void queryClient.invalidateQueries({ queryKey: ["exports", "list"] });
    },
  });
}

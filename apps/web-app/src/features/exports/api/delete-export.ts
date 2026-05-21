import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";

export interface DeleteExportVariables {
  readonly id: string;
}

/**
 * Remove an audit row. The PDF on the user's disk is unaffected — this only
 * cleans up the history entry. Mirrors ``useDeleteTrip`` but the success
 * toast is intentionally softer ("Removed from history") so the driver
 * doesn't expect a file deletion.
 */
export function useDeleteExportRecord(): UseMutationResult<
  undefined,
  Error,
  DeleteExportVariables
> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, DeleteExportVariables>({
    mutationFn: async ({ id }) => {
      const token = await getToken();
      return apiFetch<undefined>(`/api/exports/${id}/`, { method: "DELETE", token });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exports", "list"] });
      toast.success("Removed from history");
    },
    onError: () => {
      toast.error("Couldn't remove the record. Try again in a moment.");
    },
  });
}

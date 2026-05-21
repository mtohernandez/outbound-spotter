import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";

export interface DeleteTripVariables {
  readonly id: string;
}

export function useDeleteTrip(): UseMutationResult<undefined, Error, DeleteTripVariables> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, DeleteTripVariables>({
    mutationFn: async ({ id }) => {
      const token = await getToken();
      return apiFetch<undefined>(`/api/trips/${id}/`, { method: "DELETE", token });
    },
    onSuccess: () => {
      // Prefix invalidation: TanStack v5 partial-matches the key so every
      // ["trips","list",{...}] page entry is refreshed.
      void queryClient.invalidateQueries({ queryKey: ["trips", "list"] });
      toast.success("Trip deleted");
    },
    onError: () => {
      toast.error("Couldn't delete trip");
    },
  });
}

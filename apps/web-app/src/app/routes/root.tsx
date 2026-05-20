import { useAuth, useUser } from "@clerk/react";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api-client";

interface MeResponse {
  readonly user_id: string;
  readonly session_id: string | null;
  readonly email: string | null;
}

export function RootRoute(): React.ReactElement {
  return (
    <RequireAuth>
      <RootContent />
    </RequireAuth>
  );
}

function RootContent(): React.ReactElement {
  const { user } = useUser();
  const { getToken } = useAuth();

  const me = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<MeResponse>("/api/me/", { token });
    },
  });

  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center">
      <section className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">Outbound Spotter</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as{" "}
          <span className="text-foreground">
            {user?.primaryEmailAddress?.emailAddress ?? user?.id ?? "unknown"}
          </span>
          .
        </p>
        <p className="text-muted-foreground text-xs">
          web-api says: <MeStatus state={me} />
        </p>
      </section>
    </main>
  );
}

function MeStatus({ state }: { readonly state: UseQueryResult<MeResponse> }): React.ReactElement {
  if (state.isPending) return <>verifying session…</>;
  if (state.isError) return <>error — {state.error.message}</>;
  return (
    <>
      user_id {state.data.user_id} · session {state.data.session_id ?? "?"}
    </>
  );
}

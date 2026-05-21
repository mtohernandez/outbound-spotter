import { toast } from "sonner";

const FALLBACK_MESSAGE = "Something went wrong";

export function reportableError(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : FALLBACK_MESSAGE;
  toast.error(message, context === undefined ? undefined : { description: context });
  // Single observability seam; future Sentry hook plugs in here.
  console.error("[reportable]", context, error);
}

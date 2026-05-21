import { toast } from "sonner";

const FALLBACK_MESSAGE = "Something went wrong";

/**
 * Surface an error to both the user (sonner toast) and the developer (console).
 *
 * `scope` is a developer-facing tag — it lands in `console.error` only, never
 * in the user-visible toast. To customise the toast body, construct an Error
 * with a descriptive `message` (and optionally `{ cause: original }` so the
 * underlying error survives in telemetry).
 */
export function reportableError(error: unknown, scope?: string): void {
  const message = error instanceof Error ? error.message : FALLBACK_MESSAGE;
  toast.error(message);
  // Single observability seam; future Sentry hook plugs in here.
  console.error("[reportable]", scope ?? "(no-scope)", error);
}

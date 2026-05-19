import type { AuthError, ErrorSurface } from "../types/flow-state";

interface WithErrors {
  errors?: AuthError[];
}

export function extractClerkErrors(error: unknown): AuthError[] {
  if (error && typeof error === "object" && Array.isArray((error as WithErrors).errors)) {
    return (error as WithErrors).errors ?? [];
  }
  return [];
}

export function splitClerkErrors(errors: AuthError[]): ErrorSurface {
  const banner: AuthError[] = [];
  const field: Record<string, string> = {};

  for (const error of errors) {
    const meta = (error as { meta?: { paramName?: string } }).meta;
    const longMessage = (error as { longMessage?: string }).longMessage;
    if (meta?.paramName) {
      field[meta.paramName] = longMessage ?? error.message;
    } else {
      banner.push(error);
    }
  }

  return { banner, field };
}

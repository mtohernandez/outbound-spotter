import type { ErrorSurface } from "../types/flow-state";
import type { ClerkAPIError } from "@clerk/shared/types";

interface MaybeClerkError {
  errors?: ClerkAPIError[];
}

export function extractClerkErrors(error: unknown): ClerkAPIError[] {
  if (error && typeof error === "object" && Array.isArray((error as MaybeClerkError).errors)) {
    return (error as MaybeClerkError).errors ?? [];
  }
  return [];
}

export function splitClerkErrors(errors: ClerkAPIError[]): ErrorSurface {
  const banner: ClerkAPIError[] = [];
  const field: Record<string, string> = {};

  for (const error of errors) {
    const paramName = (error.meta as { paramName?: string } | undefined)?.paramName;
    if (paramName) {
      field[paramName] = error.longMessage ?? error.message;
    } else {
      banner.push(error);
    }
  }

  return { banner, field };
}

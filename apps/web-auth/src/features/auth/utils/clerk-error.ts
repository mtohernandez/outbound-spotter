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

// Clerk's `meta.paramName` uses Clerk's parameter names (`identifier`, `email_address`,
// `password`, …) while our form fields use UX names (`email`, `password`). Normalize so a
// server-side email error lights up the email Field instead of falling through to the banner.
const PARAM_ALIAS: Record<string, string> = {
  identifier: "email",
  email_address: "email",
};

export function splitClerkErrors(errors: AuthError[]): ErrorSurface {
  const banner: AuthError[] = [];
  const field: Record<string, string> = {};

  for (const error of errors) {
    const paramName = error.meta?.paramName;
    if (paramName) {
      const key = PARAM_ALIAS[paramName] ?? paramName;
      field[key] = error.longMessage ?? error.message;
    } else {
      banner.push(error);
    }
  }

  return { banner, field };
}

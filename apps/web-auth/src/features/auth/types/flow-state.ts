// Structural alias for Clerk's runtime error shape. The class `ClerkError` lives in @clerk/shared
// but is intentionally not exported through @clerk/shared/types, so we restate the surface we use.
// `ClerkAPIError` (the FAPI envelope) is structurally compatible with this interface.
export interface AuthError {
  readonly code: string;
  readonly message: string;
  // Optional fields explicitly include `undefined` so ClerkError (whose `longMessage` is
  // `string | undefined`) is assignable under `exactOptionalPropertyTypes: true`.
  readonly longMessage?: string | undefined;
  readonly meta?: { paramName?: string } | undefined;
}

export type SignInState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; errors: AuthError[] };

export type SignUpState =
  | { phase: "collect" }
  | { phase: "submitting" }
  | { phase: "verifying"; emailAddress: string }
  | { phase: "complete" }
  | { phase: "error"; errors: AuthError[] };

export type ForgotPasswordState =
  | { phase: "request" }
  | { phase: "verifying"; emailAddress: string }
  | { phase: "reset"; emailAddress: string }
  | { phase: "complete" }
  | { phase: "error"; errors: AuthError[] };

export type FieldErrorMap = Record<string, string>;

export interface ErrorSurface {
  readonly banner: AuthError[];
  readonly field: FieldErrorMap;
}

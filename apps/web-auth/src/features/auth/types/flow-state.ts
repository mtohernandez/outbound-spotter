import type { ClerkAPIError } from "@clerk/shared/types";

export type SignInState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; errors: ClerkAPIError[] };

export type SignUpState =
  | { phase: "collect" }
  | { phase: "submitting" }
  | { phase: "verifying"; emailAddress: string }
  | { phase: "complete" }
  | { phase: "error"; errors: ClerkAPIError[] };

export type ForgotPasswordState =
  | { phase: "request" }
  | { phase: "verifying"; emailAddress: string }
  | { phase: "reset"; emailAddress: string }
  | { phase: "complete" }
  | { phase: "error"; errors: ClerkAPIError[] };

export type FieldErrorMap = Record<string, string>;

export interface ErrorSurface {
  readonly banner: ClerkAPIError[];
  readonly field: FieldErrorMap;
}

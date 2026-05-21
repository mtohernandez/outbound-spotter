import { useSignIn } from "@clerk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Button } from "@outbound/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@outbound/ui/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { Link } from "react-router";

import { env } from "@/config/env";
import { useAnnouncer } from "@/hooks/use-announcer";
import { useDocumentTitle } from "@/hooks/use-document-title";

import {
  completePasswordReset,
  resendPasswordResetCode,
  startPasswordReset,
  verifyResetCode,
} from "../api/forgot-password";
import { finalizeSignIn } from "../api/sign-in";
import { splitClerkErrors } from "../utils/clerk-error";
import {
  forgotPasswordEmailSchema,
  forgotPasswordResetSchema,
  type ForgotPasswordResetValues,
} from "../utils/password-rules";

import { HeaderActions } from "./header-actions";
import { PasswordInput } from "./password-input";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { VerificationStep } from "./verification-step";

import type { AuthError } from "../types/flow-state";

type Phase =
  | { name: "request" }
  | { name: "verifying"; emailAddress: string }
  | { name: "reset"; emailAddress: string };

interface RequestValues {
  email: string;
}

const PHASE_TITLES: Record<Phase["name"], string> = {
  request: "Reset password",
  verifying: "Check your email",
  reset: "Set new password",
};

export function ForgotPasswordForm(): React.ReactElement {
  const { signIn, fetchStatus } = useSignIn();
  const [phase, setPhase] = useState<Phase>({ name: "request" });
  const [serverErrors, setServerErrors] = useState<AuthError[]>([]);
  const { message: statusMessage, announce: announceStatus, clear: clearStatus } = useAnnouncer();
  useDocumentTitle(PHASE_TITLES[phase.name]);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ForgotPasswordResetValues>({
    resolver: zodResolver(forgotPasswordResetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const resetPasswordValue = useWatch({ control: resetForm.control, name: "password" });
  const isBusy =
    requestForm.formState.isSubmitting ||
    resetForm.formState.isSubmitting ||
    fetchStatus === "fetching";

  const onRequest = requestForm.handleSubmit(async (values) => {
    // Hook returns null until Clerk hydrates; types lie that it's always populated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!signIn) return;
    setServerErrors([]);
    const result = await startPasswordReset(signIn, { emailAddress: values.email });
    // Per OWASP: surface "code sent" optimistically regardless of whether the email is registered,
    // so the UI cannot be probed for enumeration. The underlying Clerk error is deliberately not
    // logged (a console.warn() would leak the error code to anyone with DevTools open).
    announceStatus("Verification code sent. Check your email.");
    const emailAddress = result.status === "error" ? values.email : result.emailAddress;
    setPhase({ name: "verifying", emailAddress });
  });

  const onReset = resetForm.handleSubmit(async (values) => {
    // Hook returns null until Clerk hydrates; types lie that it's always populated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!signIn) return;
    setServerErrors([]);
    const result = await completePasswordReset(signIn, { password: values.password });
    if (result.status === "error") {
      setServerErrors(result.errors);
      return;
    }
    if (result.status === "complete") {
      const finalizeError = await finalizeSignIn(signIn);
      if (finalizeError) {
        setServerErrors([finalizeError]);
        return;
      }
      window.location.assign(env.VITE_APP_URL);
    }
  });

  // Polite live region is rendered for every phase so AT picks up content INJECTION (not the
  // less-reliable region-mount-with-content path). See ui-visual-validator round-3 finding M-3.
  const politeRegion = (
    <span aria-live="polite" className="sr-only">
      {statusMessage}
    </span>
  );

  if (phase.name === "verifying") {
    return (
      <>
        {politeRegion}
        <VerificationStep
          emailAddress={phase.emailAddress}
          onVerify={async (code) => {
            const result = await verifyResetCode(signIn, { code });
            if (result.status === "error") return result.errors[0] ?? null;
            setPhase({ name: "reset", emailAddress: phase.emailAddress });
            return null;
          }}
          onResend={async () => {
            const error = await resendPasswordResetCode(signIn);
            if (!error) announceStatus("Verification code resent. Check your email.");
            return error;
          }}
          onBack={() => {
            setPhase({ name: "request" });
            clearStatus();
          }}
        />
      </>
    );
  }

  if (phase.name === "reset") {
    return (
      <>
        {politeRegion}
        <ResetPasswordPhase
          resetForm={resetForm}
          resetPasswordValue={resetPasswordValue}
          serverErrors={serverErrors}
          isBusy={isBusy}
          onSubmit={onReset}
        />
      </>
    );
  }

  const { banner } = splitClerkErrors(serverErrors);
  return (
    <>
      {politeRegion}
      <Card className="border-border bg-card mx-auto w-full max-w-md shadow-sm">
        <CardHeader>
          <HeaderActions />
          <CardTitle className="font-display text-2xl">Reset your password</CardTitle>
          <CardDescription>
            We will email you a 6-digit code to verify your identity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={(event) => {
              void onRequest(event);
            }}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(requestForm.formState.errors.email)}>
                <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  autoCorrect="off"
                  aria-invalid={Boolean(requestForm.formState.errors.email)}
                  aria-describedby="forgot-email-error"
                  {...requestForm.register("email")}
                />
                <FieldError id="forgot-email-error">
                  {requestForm.formState.errors.email?.message}
                </FieldError>
              </Field>
            </FieldGroup>
            {banner.length > 0 ? (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-sm"
              >
                {banner.map((error) => (
                  <p key={error.code}>{error.longMessage ?? error.message}</p>
                ))}
              </div>
            ) : null}
            <Button type="submit" className="mt-5 w-full" disabled={isBusy}>
              {isBusy ? <SpotterLoader size="sm" /> : null}
              Send reset code
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-muted-foreground text-sm">
            Remembered it?{" "}
            <Link
              to="/sign-in"
              className="text-primary focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </>
  );
}

interface ResetPasswordPhaseProps {
  readonly resetForm: UseFormReturn<ForgotPasswordResetValues>;
  readonly resetPasswordValue: string;
  readonly serverErrors: AuthError[];
  readonly isBusy: boolean;
  readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
}

function ResetPasswordPhase({
  resetForm,
  resetPasswordValue,
  serverErrors,
  isBusy,
  onSubmit,
}: ResetPasswordPhaseProps): React.ReactElement {
  // Spec §"Accessibility floor": on the verifying → reset phase transition, focus moves to the
  // first interactive element of the new phase. Mirrors the pattern used in VerificationStep.
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const passwordRegister = resetForm.register("password");
  const { banner, field } = splitClerkErrors(serverErrors);

  return (
    <Card className="border-border bg-card mx-auto w-full max-w-md shadow-sm">
      <CardHeader>
        <HeaderActions />
        <CardTitle className="font-display text-2xl">Set a new password</CardTitle>
        <CardDescription>Pick a password you have not used elsewhere.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(resetForm.formState.errors.password ?? field.password)}>
              <FieldLabel htmlFor="reset-password">New password</FieldLabel>
              <PasswordInput
                id="reset-password"
                autoComplete="new-password"
                aria-invalid={Boolean(resetForm.formState.errors.password ?? field.password)}
                aria-describedby="reset-password-error"
                {...passwordRegister}
                ref={(node) => {
                  passwordRegister.ref(node);
                  passwordRef.current = node;
                }}
              />
              <PasswordStrengthMeter value={resetPasswordValue} />
              <FieldError id="reset-password-error">
                {resetForm.formState.errors.password?.message ?? field.password}
              </FieldError>
            </Field>
            <Field data-invalid={Boolean(resetForm.formState.errors.confirmPassword)}>
              <FieldLabel htmlFor="reset-confirm">Confirm password</FieldLabel>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                aria-invalid={Boolean(resetForm.formState.errors.confirmPassword)}
                aria-describedby="reset-confirm-error"
                {...resetForm.register("confirmPassword")}
              />
              <FieldError id="reset-confirm-error">
                {resetForm.formState.errors.confirmPassword?.message}
              </FieldError>
            </Field>
          </FieldGroup>
          {banner.length > 0 ? (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-sm"
            >
              {banner.map((error) => (
                <p key={error.code}>{error.longMessage ?? error.message}</p>
              ))}
            </div>
          ) : null}
          <Button type="submit" className="mt-5 w-full" disabled={isBusy}>
            {isBusy ? <SpotterLoader size="sm" /> : null}
            Save new password
          </Button>
        </form>
      </CardContent>
      <CardFooter className="hidden" />
    </Card>
  );
}

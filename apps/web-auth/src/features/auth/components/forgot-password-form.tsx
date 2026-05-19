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
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";

import { env } from "@/config/env";

import { completePasswordReset, startPasswordReset, verifyResetCode } from "../api/forgot-password";
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

export function ForgotPasswordForm(): React.ReactElement {
  const { signIn, fetchStatus } = useSignIn();
  const [phase, setPhase] = useState<Phase>({ name: "request" });
  const [serverErrors, setServerErrors] = useState<AuthError[]>([]);

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
    if (result.status === "error") {
      // Per OWASP: surface "code sent" optimistically even if the email is unregistered to avoid
      // user-enumeration. We still log the underlying error to the console for support triage.
      console.warn("startPasswordReset error", result.errors);
      setPhase({ name: "verifying", emailAddress: values.email });
      return;
    }
    setPhase({ name: "verifying", emailAddress: result.emailAddress });
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

  if (phase.name === "verifying") {
    return (
      <VerificationStep
        emailAddress={phase.emailAddress}
        onVerify={async (code) => {
          const result = await verifyResetCode(signIn, { code });
          if (result.status === "error") return result.errors[0] ?? null;
          setPhase({ name: "reset", emailAddress: phase.emailAddress });
          return null;
        }}
        onResend={async () => {
          const result = await startPasswordReset(signIn, { emailAddress: phase.emailAddress });
          return result.status === "error" ? (result.errors[0] ?? null) : null;
        }}
        onBack={() => {
          setPhase({ name: "request" });
        }}
      />
    );
  }

  if (phase.name === "reset") {
    const { banner, field } = splitClerkErrors(serverErrors);
    return (
      <Card className="border-border bg-card mx-auto w-full max-w-[28rem] shadow-sm">
        <CardHeader>
          <HeaderActions />
          <CardTitle className="font-display text-2xl">Set a new password</CardTitle>
          <CardDescription>Pick a password you have not used elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={(event) => {
              void onReset(event);
            }}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(resetForm.formState.errors.password ?? field.password)}>
                <FieldLabel htmlFor="reset-password">New password</FieldLabel>
                <PasswordInput
                  id="reset-password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(resetForm.formState.errors.password ?? field.password)}
                  {...resetForm.register("password")}
                />
                <PasswordStrengthMeter value={resetPasswordValue} />
                <FieldError>
                  {resetForm.formState.errors.password?.message ?? field.password}
                </FieldError>
              </Field>
              <Field data-invalid={Boolean(resetForm.formState.errors.confirmPassword)}>
                <FieldLabel htmlFor="reset-confirm">Confirm password</FieldLabel>
                <PasswordInput
                  id="reset-confirm"
                  autoComplete="new-password"
                  aria-invalid={Boolean(resetForm.formState.errors.confirmPassword)}
                  {...resetForm.register("confirmPassword")}
                />
                <FieldError>{resetForm.formState.errors.confirmPassword?.message}</FieldError>
              </Field>
            </FieldGroup>
            {banner.length > 0 ? (
              <div
                role="alert"
                aria-live="assertive"
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

  const { banner } = splitClerkErrors(serverErrors);
  return (
    <Card className="border-border bg-card mx-auto w-full max-w-[28rem] shadow-sm">
      <CardHeader>
        <HeaderActions />
        <CardTitle className="font-display text-2xl">Reset your password</CardTitle>
        <CardDescription>We will email you a 6-digit code to verify your identity.</CardDescription>
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
                {...requestForm.register("email")}
              />
              <FieldError>{requestForm.formState.errors.email?.message}</FieldError>
            </Field>
          </FieldGroup>
          {banner.length > 0 ? (
            <div
              role="alert"
              aria-live="assertive"
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
          <Link to="/sign-in" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

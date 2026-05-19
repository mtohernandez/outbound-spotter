import { useSignUp } from "@clerk/react";
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
import { Separator } from "@outbound/ui/components/ui/separator";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";

import { env } from "@/config/env";

import {
  finalizeSignUp,
  resendVerificationCode,
  startSignUp,
  startSignUpGoogleOAuth,
  verifySignUpCode,
} from "../api/sign-up";
import { splitClerkErrors } from "../utils/clerk-error";
import {
  MIN_PASSWORD_SCORE,
  signUpSchema,
  type PasswordScore,
  type SignUpValues,
} from "../utils/password-rules";

import { ClerkCaptcha } from "./clerk-captcha";
import { HeaderActions } from "./header-actions";
import { OAuthButtonGroup } from "./oauth-button-group";
import { PasswordInput } from "./password-input";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { VerificationStep } from "./verification-step";

import type { AuthError } from "../types/flow-state";

type Phase = { name: "collect" } | { name: "verifying"; emailAddress: string };

export function SignUpForm(): React.ReactElement {
  const { signUp, fetchStatus } = useSignUp();
  const [phase, setPhase] = useState<Phase>({ name: "collect" });
  const [serverErrors, setServerErrors] = useState<AuthError[]>([]);
  const [passwordScore, setPasswordScore] = useState<PasswordScore>(0);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "" },
  });

  const passwordValue = useWatch({ control: form.control, name: "password" });
  const emailValue = useWatch({ control: form.control, name: "email" });
  const isBusy = form.formState.isSubmitting || fetchStatus === "fetching";

  const onSubmit = form.handleSubmit(async (values) => {
    setServerErrors([]);
    if (passwordScore < MIN_PASSWORD_SCORE) {
      form.setError("password", {
        message: "Try a longer or less predictable password.",
      });
      return;
    }
    const result = await startSignUp(signUp, {
      emailAddress: values.email,
      password: values.password,
    });
    if (result.status === "error") {
      setServerErrors(result.errors);
      return;
    }
    if (result.status === "complete") {
      const error = await finalizeSignUp(signUp);
      if (error) {
        setServerErrors([error]);
        return;
      }
      window.location.assign(env.VITE_APP_URL);
      return;
    }
    setPhase({ name: "verifying", emailAddress: result.emailAddress });
  });

  const onGoogle = async () => {
    setServerErrors([]);
    const error = await startSignUpGoogleOAuth(signUp, {
      redirectUrl: env.VITE_APP_URL,
      redirectCallbackUrl: `${window.location.origin}/sso-callback`,
    });
    if (error) setServerErrors([error]);
  };

  if (phase.name === "verifying") {
    return (
      <VerificationStep
        emailAddress={phase.emailAddress}
        onVerify={async (code) => {
          const result = await verifySignUpCode(signUp, { code });
          if (result.status === "error") return result.errors[0] ?? null;
          if (result.status === "complete") {
            const finalizeError = await finalizeSignUp(signUp);
            if (finalizeError) return finalizeError;
            window.location.assign(env.VITE_APP_URL);
          }
          return null;
        }}
        onResend={async () => resendVerificationCode(signUp)}
        onBack={() => {
          setPhase({ name: "collect" });
          setServerErrors([]);
        }}
      />
    );
  }

  const { banner, field } = splitClerkErrors(serverErrors);

  return (
    <Card className="border-border bg-card mx-auto w-full max-w-[28rem] shadow-sm">
      <CardHeader>
        <HeaderActions />
        <CardTitle className="font-display text-2xl">Create your account</CardTitle>
        <CardDescription>Start planning compliant trips in seconds.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <OAuthButtonGroup onContinueWithGoogle={onGoogle} disabled={isBusy} />
        <div className="text-muted-foreground flex items-center gap-3 text-xs tracking-wide uppercase">
          <Separator className="flex-1" />
          <span>or</span>
          <Separator className="flex-1" />
        </div>
        <form
          noValidate
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.email ?? field.email)}>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoCorrect="off"
                aria-invalid={Boolean(form.formState.errors.email ?? field.email)}
                {...form.register("email")}
              />
              <FieldError>{form.formState.errors.email?.message ?? field.email}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.password ?? field.password)}>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <PasswordInput
                id="signup-password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.password ?? field.password)}
                {...form.register("password")}
              />
              <PasswordStrengthMeter
                value={passwordValue}
                userInputs={emailValue ? [emailValue.split("@")[0] ?? ""] : []}
                onScoreChange={setPasswordScore}
              />
              <FieldError>{form.formState.errors.password?.message ?? field.password}</FieldError>
            </Field>
          </FieldGroup>
          <div className="mt-4">
            <ClerkCaptcha />
          </div>
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
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link to="/sign-in" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

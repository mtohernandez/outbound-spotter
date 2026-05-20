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
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";

import { env } from "@/config/env";
import { useAnnouncer } from "@/hooks/use-announcer";
import { useDocumentTitle } from "@/hooks/use-document-title";

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
  useDocumentTitle(phase.name === "verifying" ? "Check your email" : "Create account");
  const [serverErrors, setServerErrors] = useState<AuthError[]>([]);
  const [passwordScore, setPasswordScore] = useState<PasswordScore>(0);
  const { message: statusMessage, announce: announceStatus, clear: clearStatus } = useAnnouncer();

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "" },
  });

  const passwordValue = useWatch({ control: form.control, name: "password", defaultValue: "" });
  const emailValue = useWatch({ control: form.control, name: "email", defaultValue: "" });
  const isBusy = form.formState.isSubmitting || fetchStatus === "fetching";
  // Memoize the parent-supplied user inputs so the strength meter's debounce isn't bypassed
  // by a fresh-array reference on every keystroke.
  const userInputs = useMemo(
    () => (emailValue ? [emailValue.split("@")[0] ?? ""] : []),
    [emailValue],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    // Hook returns null until Clerk hydrates; types lie that it's always populated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!signUp) return;
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
    announceStatus("Verification code sent. Check your email.");
    setPhase({ name: "verifying", emailAddress: result.emailAddress });
  });

  const onGoogle = async () => {
    // Hook returns null until Clerk hydrates; types lie that it's always populated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!signUp) return;
    setServerErrors([]);
    const error = await startSignUpGoogleOAuth(signUp, {
      redirectUrl: env.VITE_APP_URL,
      redirectCallbackUrl: `${window.location.origin}/sso-callback`,
    });
    if (error) setServerErrors([error]);
  };

  const { banner, field } = splitClerkErrors(serverErrors);

  // Live region is rendered unconditionally so the screen reader picks up content INJECTION
  // (vs the region first mounting with content, which VoiceOver swallows on the verifying phase
  // transition). See round-3 ui-visual-validator finding M-3.
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
            const result = await verifySignUpCode(signUp, { code });
            if (result.status === "error") return result.errors[0] ?? null;
            if (result.status === "complete") {
              const finalizeError = await finalizeSignUp(signUp);
              if (finalizeError) return finalizeError;
              window.location.assign(env.VITE_APP_URL);
            }
            return null;
          }}
          onResend={async () => {
            const error = await resendVerificationCode(signUp);
            if (!error) announceStatus("Verification code resent. Check your email.");
            return error;
          }}
          onBack={() => {
            form.reset({ email: "", password: "" });
            setPhase({ name: "collect" });
            setServerErrors([]);
            setPasswordScore(0);
            clearStatus();
          }}
        />
      </>
    );
  }

  return (
    <>
      {politeRegion}
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
                  aria-describedby="signup-email-error"
                  {...form.register("email")}
                />
                <FieldError id="signup-email-error">
                  {form.formState.errors.email?.message ?? field.email}
                </FieldError>
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.password ?? field.password)}>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <PasswordInput
                  id="signup-password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(form.formState.errors.password ?? field.password)}
                  aria-describedby="signup-password-error"
                  {...form.register("password")}
                />
                <PasswordStrengthMeter
                  value={passwordValue}
                  userInputs={userInputs}
                  onScoreChange={setPasswordScore}
                />
                <FieldError id="signup-password-error">
                  {form.formState.errors.password?.message ?? field.password}
                </FieldError>
              </Field>
            </FieldGroup>
            <div className="mt-4">
              <ClerkCaptcha />
            </div>
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
    </>
  );
}

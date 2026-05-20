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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { Separator } from "@outbound/ui/components/ui/separator";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";

import { env } from "@/config/env";
import { useDocumentTitle } from "@/hooks/use-document-title";

import { finalizeSignIn, signInWithPassword, startGoogleOAuth } from "../api/sign-in";
import { splitClerkErrors } from "../utils/clerk-error";
import { signInSchema, type SignInValues } from "../utils/password-rules";

import { HeaderActions } from "./header-actions";
import { OAuthButtonGroup } from "./oauth-button-group";
import { PasswordInput } from "./password-input";

import type { AuthError } from "../types/flow-state";

export function SignInForm(): React.ReactElement {
  useDocumentTitle("Sign in");
  const { signIn, fetchStatus } = useSignIn();
  const [serverErrors, setServerErrors] = useState<AuthError[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const passwordRegister = form.register("password");

  useEffect(() => {
    // Spec §"Accessibility floor": after a server error, focus returns to the offending field
    // so the user can immediately re-enter or correct their credentials.
    if (serverErrors.length > 0) passwordRef.current?.focus();
  }, [serverErrors]);

  const isBusy = form.formState.isSubmitting || fetchStatus === "fetching";

  const onSubmit = form.handleSubmit(async (values) => {
    // Hook returns null until Clerk hydrates; types lie that it's always populated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!signIn) return;
    setServerErrors([]);
    const result = await signInWithPassword(signIn, {
      identifier: values.email,
      password: values.password,
    });
    if (result.status === "error") {
      setServerErrors(result.errors);
      return;
    }
    if (result.status === "complete") {
      const error = await finalizeSignIn(signIn);
      if (error) {
        setServerErrors([error]);
        return;
      }
      window.location.assign(env.VITE_APP_URL);
    }
  });

  const onGoogle = async () => {
    // Hook returns null until Clerk hydrates; types lie that it's always populated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!signIn) return;
    setServerErrors([]);
    const error = await startGoogleOAuth(signIn, {
      redirectUrl: env.VITE_APP_URL,
      redirectCallbackUrl: `${window.location.origin}/sso-callback`,
    });
    if (error) setServerErrors([error]);
  };

  const { banner, field } = splitClerkErrors(serverErrors);

  return (
    <Card className="border-border bg-card mx-auto w-full max-w-md shadow-sm">
      <CardHeader>
        <HeaderActions />
        <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to Outbound Spotter</CardDescription>
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
              <FieldLabel htmlFor="signin-email">Email</FieldLabel>
              <Input
                id="signin-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoCorrect="off"
                aria-invalid={Boolean(form.formState.errors.email ?? field.email)}
                aria-describedby="signin-email-error"
                {...form.register("email")}
              />
              <FieldError id="signin-email-error">
                {form.formState.errors.email?.message ?? field.email}
              </FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.password ?? field.password)}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="signin-password">Password</FieldLabel>
                <Link
                  to="/forgot-password"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="signin-password"
                autoComplete="current-password"
                aria-invalid={Boolean(form.formState.errors.password ?? field.password)}
                aria-describedby="signin-password-error"
                {...passwordRegister}
                ref={(node) => {
                  passwordRegister.ref(node);
                  passwordRef.current = node;
                }}
              />
              <FieldError id="signin-password-error">
                {form.formState.errors.password?.message ?? field.password}
              </FieldError>
              <FieldDescription className="sr-only">
                Need help? Contact {env.VITE_SUPPORT_EMAIL}.
              </FieldDescription>
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
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Don&apos;t have an account?{" "}
          <Link to="/sign-up" className="text-primary underline-offset-2 hover:underline">
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

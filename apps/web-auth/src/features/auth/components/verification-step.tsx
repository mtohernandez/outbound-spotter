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
import { useEffect, useRef, useState } from "react";

import { HeaderActions } from "./header-actions";
import { VerificationCodeInput, type VerificationCodeInputHandle } from "./verification-code-input";

import type { AuthError } from "../types/flow-state";

const RESEND_COOLDOWN_SECONDS = 30;

interface Props {
  readonly emailAddress: string;
  readonly onVerify: (code: string) => Promise<AuthError | null>;
  readonly onResend: () => Promise<AuthError | null>;
  readonly onBack: () => void;
}

export function VerificationStep({
  emailAddress,
  onVerify,
  onResend,
  onBack,
}: Props): React.ReactElement {
  const focusRef = useRef<VerificationCodeInputHandle>(null);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<AuthError[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const id = setTimeout(() => {
      setResendCountdown((current) => current - 1);
    }, 1000);
    return () => {
      clearTimeout(id);
    };
  }, [resendCountdown]);

  const handleSubmit = async (next: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setErrors([]);
    const error = await onVerify(next);
    setIsVerifying(false);
    if (error) {
      setErrors([error]);
      setCode("");
      focusRef.current?.focus();
    }
  };

  const onResendClick = async () => {
    if (resendCountdown > 0) return;
    setErrors([]);
    const error = await onResend();
    if (error) {
      setErrors([error]);
      return;
    }
    setResendCountdown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <Card className="border-border bg-card mx-auto w-full max-w-md shadow-sm">
      <CardHeader>
        <HeaderActions />
        <CardTitle className="font-display text-2xl">Check your email</CardTitle>
        <CardDescription>
          We sent a 6-digit code to <strong>{emailAddress}</strong>. Enter it below to finish.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <VerificationCodeInput
          ref={focusRef}
          value={code}
          onChange={setCode}
          onComplete={handleSubmit}
          disabled={isVerifying}
        />
        {errors.length > 0 ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {errors.map((error) => (
              <p key={error.code}>{error.longMessage ?? error.message}</p>
            ))}
          </div>
        ) : null}
        <Button
          type="button"
          className="w-full"
          disabled={isVerifying || code.length < 6}
          onClick={() => {
            void handleSubmit(code);
          }}
        >
          {isVerifying ? <SpotterLoader size="sm" /> : null}
          Verify
        </Button>
        <div className="flex flex-col items-center gap-2 text-sm">
          {/* WCAG 2.5.8 Target Size (Minimum) — interactive ≥ 24 CSS px in both axes. */}
          <button
            type="button"
            onClick={() => {
              void onResendClick();
            }}
            disabled={resendCountdown > 0}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-6 items-center justify-center rounded-sm px-2 py-1 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-6 items-center justify-center rounded-sm px-2 py-1 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Use a different email
          </button>
        </div>
      </CardContent>
      <CardFooter className="hidden" />
    </Card>
  );
}

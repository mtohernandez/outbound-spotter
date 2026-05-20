import { Field, FieldDescription, FieldError, FieldLabel } from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { useId, useMemo } from "react";
import { useController, type Control } from "react-hook-form";

import type { TripInput } from "@/features/trip-planner/schemas/trip-input";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/features/trip-planner/utils/round-time";

interface Props {
  readonly control: Control<TripInput>;
}

export function StartAtField({ control }: Props): React.ReactElement {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;

  // Source-of-truth for "must be in the future" is the zod refinement on
  // `startAtSchema` (re-reads `Date.now()` every parse). We deliberately
  // do NOT pin a `min` attribute on the input — capturing now-at-mount
  // would lie to the user if they linger on the form past the default
  // time (typescript-pro M1). The picker stays open-ended; submit-time
  // validation rejects past values with a visible FieldError.

  // `useController` defaultValue is omitted — the parent form's
  // `defaultValues.startAt` already seeds the initial ISO with one
  // `roundUpToNext15Min(...)` computation at form mount, which is the
  // single source for the default (typescript-pro M3 closure).
  const { field, fieldState } = useController({ control, name: "startAt" });
  const invalid = Boolean(fieldState.error);

  // Display the stored ISO (UTC, what `.toISOString()` produces, what the
  // BE receives) as a local-clock value for the native datetime-local
  // picker. The picker emits a local-naive string on change; we re-convert
  // to ISO on its way back to form state.
  const localValue = useMemo(() => {
    if (!field.value) return "";
    const date = new Date(field.value);
    return Number.isNaN(date.valueOf()) ? "" : toDatetimeLocalValue(date);
  }, [field.value]);

  return (
    <Field data-invalid={invalid ? "true" : undefined}>
      <div className="flex items-baseline justify-between">
        <FieldLabel htmlFor={inputId}>Start time</FieldLabel>
        <span className="text-muted-foreground text-xs">in your local timezone</span>
      </div>
      <FieldDescription id={descriptionId}>
        When the driver starts the trip. 15-minute increments; can&rsquo;t be in the past.
      </FieldDescription>
      <Input
        id={inputId}
        type="datetime-local"
        step={900}
        value={localValue}
        aria-describedby={`${descriptionId}${invalid ? ` ${errorId}` : ""}`}
        aria-invalid={invalid}
        data-invalid={invalid ? "true" : undefined}
        onChange={(event) => {
          const next = event.target.value;
          field.onChange(next ? fromDatetimeLocalValue(next) : "");
        }}
        onBlur={field.onBlur}
        className="font-mono tabular-nums"
      />
      {invalid ? <FieldError id={errorId}>{fieldState.error?.message}</FieldError> : null}
    </Field>
  );
}

import { Field, FieldDescription, FieldError, FieldLabel } from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { useId, useMemo } from "react";
import { useController, type Control } from "react-hook-form";

import type { TripInput } from "@/features/trip-planner/schemas/trip-input";
import {
  fromDatetimeLocalValue,
  roundUpToNext15Min,
  toDatetimeLocalValue,
} from "@/features/trip-planner/utils/round-time";

interface Props {
  readonly control: Control<TripInput>;
}

export function StartAtField({ control }: Props): React.ReactElement {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;

  // Single computation at mount — no setInterval ticker (spec 06 anti-pattern #7).
  // If the driver lingers on the form past the default time, the past-time zod
  // refinement catches it at submit.
  const defaults = useMemo(() => {
    const rounded = roundUpToNext15Min(new Date());
    return { iso: rounded.toISOString(), localMin: toDatetimeLocalValue(rounded) };
  }, []);

  const { field, fieldState } = useController({
    control,
    name: "startAt",
    defaultValue: defaults.iso,
  });
  const invalid = Boolean(fieldState.error);

  // Display the current ISO value as a local-time picker value. RHF's stored
  // value is always ISO 8601 with offset (matches the BE contract); the local
  // form value is derived for display only.
  const localValue = useMemo(() => {
    if (!field.value) return defaults.localMin;
    const date = new Date(field.value);
    return Number.isNaN(date.valueOf()) ? defaults.localMin : toDatetimeLocalValue(date);
  }, [field.value, defaults.localMin]);

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
        min={defaults.localMin}
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

import { Field, FieldDescription, FieldError, FieldLabel } from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { Progress } from "@outbound/ui/components/ui/progress";
import { Slider } from "@outbound/ui/components/ui/slider";
import { useId } from "react";
import { useController, type Control } from "react-hook-form";

import type { TripInput } from "@/features/trip-planner/schemas/trip-input";

const MAX_CYCLE = 70;

interface Props {
  readonly control: Control<TripInput>;
}

export function CycleHoursField({ control }: Props): React.ReactElement {
  const sliderId = useId();
  const inputId = `${sliderId}-input`;
  const errorId = `${sliderId}-error`;
  const descriptionId = `${sliderId}-description`;

  const { field, fieldState } = useController({ control, name: "cycleHoursUsed" });
  const value = clampValue(field.value);
  const remaining = Math.max(0, MAX_CYCLE - value);
  const usedPercent = Math.min(100, (value / MAX_CYCLE) * 100);
  const invalid = Boolean(fieldState.error);

  return (
    <Field data-invalid={invalid ? "true" : undefined}>
      <div className="flex items-baseline justify-between">
        <FieldLabel htmlFor={sliderId}>Cycle hours used</FieldLabel>
        <span className="text-muted-foreground text-xs">of 70 h in the 8-day cycle</span>
      </div>
      <FieldDescription id={descriptionId}>
        70-hour / 8-day schedule. Half-hour increments.
      </FieldDescription>
      <div className="flex items-center gap-3">
        <Slider
          id={sliderId}
          min={0}
          max={MAX_CYCLE}
          step={0.5}
          value={[value]}
          aria-label="Cycle hours used"
          aria-describedby={`${descriptionId}${invalid ? ` ${errorId}` : ""}`}
          aria-invalid={invalid}
          onValueChange={(values) => {
            const next = values[0] ?? 0;
            field.onChange(next);
          }}
          onBlur={field.onBlur}
          className="flex-1"
        />
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_CYCLE}
          step={0.5}
          value={Number.isFinite(value) ? value : 0}
          aria-label="Cycle hours used (numeric input)"
          aria-describedby={`${descriptionId}${invalid ? ` ${errorId}` : ""}`}
          aria-invalid={invalid}
          onChange={(event) => {
            const parsed = Number.parseFloat(event.target.value);
            if (Number.isNaN(parsed)) {
              field.onChange(0);
            } else {
              field.onChange(parsed);
            }
          }}
          onBlur={field.onBlur}
          className="w-20 text-right tabular-nums"
        />
      </div>
      <Progress value={usedPercent} aria-hidden className="h-1.5" />
      <p className="text-muted-foreground text-xs">
        ≈ {remaining.toFixed(1)} h remaining in 8-day cycle
      </p>
      {invalid ? <FieldError id={errorId}>{fieldState.error?.message}</FieldError> : null}
    </Field>
  );
}

function clampValue(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > MAX_CYCLE) return MAX_CYCLE;
  return raw;
}

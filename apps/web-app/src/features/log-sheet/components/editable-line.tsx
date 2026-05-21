import { Field, FieldLabel } from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { cn } from "@outbound/ui/lib/utils";

interface EditableLineProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly autoComplete?: string;
}

// FMCSA blank-line rendering — an `<input>` with bottom-border only. Reused
// across truck/trailer/carrier/co-driver/shipping fields. The label is
// `sr-only` because the printed §395.8 form already prints the label as a
// static SVG/HTML caption — adding a visible label here would duplicate it.
export function EditableLine({
  id,
  label,
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  autoComplete = "off",
}: EditableLineProps): React.ReactElement {
  return (
    <Field className={cn("gap-0", className)}>
      <FieldLabel htmlFor={id} className="sr-only">
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        className={cn(
          "border-foreground/40 h-7 rounded-none border-0 border-b bg-transparent px-1 font-mono text-sm shadow-none motion-safe:transition-colors",
          "focus-visible:border-ring focus-visible:border-b-2 focus-visible:ring-0 focus-visible:outline-none",
          inputClassName,
        )}
      />
    </Field>
  );
}

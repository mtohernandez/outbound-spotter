import { Checkbox } from "@outbound/ui/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@outbound/ui/components/ui/field";
import { Input } from "@outbound/ui/components/ui/input";
import { cn } from "@outbound/ui/lib/utils";

interface SignatureFieldProps {
  readonly idPrefix: string;
  readonly driverLegalName: string;
  readonly signatureOverride: string;
  readonly iCertify: boolean;
  readonly onCertifyChange: (next: boolean) => void;
  readonly onSignatureOverrideChange: (next: string) => void;
}

// "I certify these entries are true and correct" — §395.8(a)(7) gate. The
// SVG signature `<text>` rendered alongside the grid only appears when this
// checkbox is checked (default: unchecked, so the driver affirmatively
// certifies each session). The Input lets the driver override the auto-
// filled Clerk legal name (e.g., a nickname they sign with), but an empty
// override falls back to driverLegalName.
export function SignatureField({
  idPrefix,
  driverLegalName,
  signatureOverride,
  iCertify,
  onCertifyChange,
  onSignatureOverrideChange,
}: SignatureFieldProps): React.ReactElement {
  const checkboxId = `${idPrefix}-i-certify`;
  const overrideId = `${idPrefix}-signature-override`;
  const renderedName = signatureOverride.trim() === "" ? driverLegalName : signatureOverride;

  return (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal" className="items-start">
        <Checkbox
          id={checkboxId}
          checked={iCertify}
          onCheckedChange={(value) => {
            onCertifyChange(value === true);
          }}
          // size-6 (24×24) meets WCAG 2.5.8 target-size minimum.
          className="mt-0.5 size-6"
        />
        <FieldLabel htmlFor={checkboxId} className="text-xs leading-snug font-normal">
          I certify that these entries are true and correct.
          <FieldDescription className="text-muted-foreground text-[10px] tracking-wider uppercase">
            §395.8(a)(7) — sign with your legal name (or name of record).
          </FieldDescription>
        </FieldLabel>
      </Field>

      <Field className="gap-0">
        <FieldLabel
          htmlFor={overrideId}
          className="text-muted-foreground text-[10px] tracking-wider uppercase"
        >
          Signature
        </FieldLabel>
        <Input
          id={overrideId}
          value={signatureOverride}
          onChange={(event) => {
            onSignatureOverrideChange(event.target.value);
          }}
          placeholder={driverLegalName}
          spellCheck={false}
          autoComplete="off"
          className={cn(
            "border-foreground/40 font-display h-9 rounded-none border-0 border-b bg-transparent px-1 text-base italic shadow-none motion-safe:transition-colors",
            "focus-visible:border-ring focus-visible:border-b-2 focus-visible:ring-0 focus-visible:outline-none",
          )}
          aria-describedby={`${idPrefix}-rendered-name`}
        />
        <FieldDescription
          id={`${idPrefix}-rendered-name`}
          className="text-muted-foreground font-mono text-[10px]"
        >
          {iCertify
            ? `Will print as: ${renderedName}`
            : 'Check "I certify" above to record this signature.'}
        </FieldDescription>
      </Field>
    </div>
  );
}

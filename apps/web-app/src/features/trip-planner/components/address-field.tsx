import { Button } from "@outbound/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@outbound/ui/components/ui/command";
import { Field, FieldDescription, FieldError, FieldLabel } from "@outbound/ui/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@outbound/ui/components/ui/popover";
import { cn } from "@outbound/ui/lib/utils";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { useId, useState } from "react";
import { useController, type Control } from "react-hook-form";

import {
  useGeocodeAutocomplete,
  type GeocodeFeature,
} from "@/features/trip-planner/api/geocode-autocomplete";
import { useDebouncedValue } from "@/features/trip-planner/hooks/use-debounced-value";
import type { TripInput } from "@/features/trip-planner/schemas/trip-input";

const DEBOUNCE_MS = 250;

// RHF surfaces nested-object errors as a tree (e.g., `{ label: { message: "..." } }`)
// because `resolvedAddressSchema` validates an object. The top-level
// `fieldState.error?.message` is therefore `undefined` even when the field IS
// invalid (zod reports the violation on `.label`). Without this drill-in,
// the `<FieldError>` rendered an empty node — screen readers heard
// "invalid" with no reason, and sighted users got no in-page hint either.
function leafErrorMessage(
  error: { message?: string; label?: { message?: string } } | undefined,
): string | null {
  return error?.message ?? error?.label?.message ?? null;
}

interface Props {
  readonly control: Control<TripInput>;
  readonly name: "current" | "pickup" | "dropoff";
  readonly label: string;
  readonly description?: string;
  readonly placeholder: string;
}

export function AddressField({
  control,
  name,
  label,
  description,
  placeholder,
}: Props): React.ReactElement {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const descriptionId = `${fieldId}-description`;

  const { field, fieldState } = useController({ control, name });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);
  const query = useGeocodeAutocomplete(debouncedSearch);

  const hasValue = field.value.label !== "";
  const errorMessage = leafErrorMessage(fieldState.error);
  const invalid = errorMessage !== null;

  function handleSelect(feature: GeocodeFeature): void {
    field.onChange({
      label: feature.label,
      lat: feature.lat,
      lon: feature.lon,
      confidence: feature.confidence,
    });
    field.onBlur();
    setSearch("");
    setOpen(false);
  }

  return (
    <Field data-invalid={invalid ? "true" : undefined}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-invalid={invalid}
            aria-describedby={
              [description ? descriptionId : null, invalid ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onKeyDown={(event) => {
              // APG combobox pattern: ArrowDown / ArrowUp / Alt+ArrowDown open
              // the listbox when collapsed. Without this, keyboard-only users
              // can't reach the suggestions.
              if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                setOpen(true);
              }
            }}
            className={cn(
              "w-full justify-between font-normal",
              !hasValue && "text-muted-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{hasValue ? field.value.label : placeholder}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search an address…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <AutocompleteBody
                search={search}
                query={query}
                onSelect={handleSelect}
                selectedKey={hasValue ? `${field.value.lat},${field.value.lon}` : null}
              />
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {invalid ? <FieldError id={errorId}>{errorMessage}</FieldError> : null}
    </Field>
  );
}

interface BodyProps {
  readonly search: string;
  readonly query: ReturnType<typeof useGeocodeAutocomplete>;
  readonly selectedKey: string | null;
  readonly onSelect: (feature: GeocodeFeature) => void;
}

function AutocompleteBody({ search, query, selectedKey, onSelect }: BodyProps): React.ReactElement {
  if (search.length < 3) {
    return (
      <CommandEmpty className="py-6 text-center text-sm">
        Type at least 3 characters to search.
      </CommandEmpty>
    );
  }
  if (query.isPending) {
    return <div className="text-muted-foreground py-6 text-center text-sm">Searching…</div>;
  }
  if (query.isError) {
    return (
      <div className="text-destructive py-6 text-center text-sm" role="alert">
        Couldn&rsquo;t reach the geocoder. Try again.
      </div>
    );
  }
  if (query.data.length === 0) {
    return <CommandEmpty className="py-6 text-center text-sm">No matches.</CommandEmpty>;
  }
  return (
    <CommandGroup>
      {query.data.map((feature) => {
        const key = `${String(feature.lat)},${String(feature.lon)}`;
        return (
          <CommandItem
            key={key}
            value={feature.label}
            onSelect={() => {
              onSelect(feature);
            }}
          >
            <Check
              className={cn("size-4", selectedKey === key ? "opacity-100" : "opacity-0")}
              aria-hidden
            />
            <span className="truncate">{feature.label}</span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

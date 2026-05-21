import { Button } from "@outbound/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@outbound/ui/components/ui/tooltip";
import { reportableError } from "@outbound/ui/lib/reportable-error";
import { Loader2, LocateFixed } from "lucide-react";

import type { GeocodeFeature } from "@/features/trip-planner/api/geocode-autocomplete";
import { useReverseGeocode } from "@/features/trip-planner/api/geocode-reverse";
import { useGeolocation } from "@/features/trip-planner/hooks/use-geolocation";

interface Props {
  readonly onLocate: (feature: GeocodeFeature) => void;
}

export function UseCurrentLocationButton({ onLocate }: Props): React.ReactElement {
  const geolocation = useGeolocation();
  const reverse = useReverseGeocode();
  const isPending = geolocation.status === "pending" || reverse.isPending;

  async function handleClick(): Promise<void> {
    const coords = await geolocation.request();
    if (coords === null) {
      const err = geolocation.error ?? new Error("Couldn't get your location.");
      reportableError(err, `use-current-location:${geolocation.status}`);
      return;
    }
    try {
      const feature = await reverse.mutateAsync({ lat: coords.lat, lon: coords.lon });
      onLocate(feature);
    } catch (caught) {
      reportableError(
        new Error("Couldn't resolve your location. Try typing an address.", { cause: caught }),
        "use-current-location:reverse",
      );
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Use my current location (US only)"
          aria-busy={isPending}
          disabled={isPending}
          onClick={() => {
            void handleClick();
          }}
        >
          {isPending ? (
            <Loader2 data-icon className="motion-safe:animate-spin" aria-hidden />
          ) : (
            <LocateFixed data-icon aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Use my current location (US only)</TooltipContent>
    </Tooltip>
  );
}

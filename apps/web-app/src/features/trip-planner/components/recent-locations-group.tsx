import { CommandGroup, CommandItem } from "@outbound/ui/components/ui/command";
import { Clock } from "lucide-react";

import type { GeocodeFeature } from "@/features/trip-planner/api/geocode-autocomplete";

interface Props {
  readonly recents: readonly GeocodeFeature[];
  readonly onSelect: (feature: GeocodeFeature) => void;
}

export function RecentLocationsGroup({ recents, onSelect }: Props): React.ReactElement | null {
  if (recents.length === 0) return null;
  return (
    <CommandGroup heading="Recent">
      {recents.map((feature) => {
        const key = `recent-${String(feature.lat)},${String(feature.lon)}`;
        return (
          <CommandItem
            key={key}
            value={feature.label}
            onSelect={() => {
              onSelect(feature);
            }}
          >
            <Clock className="size-4 opacity-60" aria-hidden />
            <span className="truncate">{feature.label}</span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

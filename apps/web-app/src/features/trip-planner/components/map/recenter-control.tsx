import { Button } from "@outbound/ui/components/ui/button";
import { Locate } from "lucide-react";

interface Props {
  readonly onRecenter: () => void;
}

// Visible affordance paired with the `R` keyboard shortcut. Sits in the
// top-right corner of the map; the `z-index` keeps it above Leaflet's tile
// pane but below open popups.
export function RecenterControl({ onRecenter }: Props): React.ReactElement {
  return (
    <div className="pointer-events-none absolute top-3 right-3 z-[400]">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="pointer-events-auto shadow-md"
        onClick={onRecenter}
        aria-label="Recenter route (press R)"
        title="Recenter route (R)"
      >
        <Locate aria-hidden="true" />
        <span>Recenter</span>
      </Button>
    </div>
  );
}

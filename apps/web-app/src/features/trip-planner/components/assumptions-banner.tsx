import { Alert, AlertDescription, AlertTitle } from "@outbound/ui/components/ui/alert";
import { Button } from "@outbound/ui/components/ui/button";
import { Info, X } from "lucide-react";
import { useState } from "react";

import { TRIP_ASSUMPTIONS } from "@/config/strings";

const STORAGE_KEY_PREFIX = "outbound-assumptions-dismissed:";

interface Props {
  readonly tripId: string;
}

function isDismissed(tripId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${tripId}`) === "1";
  } catch {
    return false;
  }
}

function persistDismissal(tripId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${tripId}`, "1");
  } catch {
    // localStorage may be unavailable (Safari private mode); the dismissal
    // is then per-session only, which is acceptable degradation.
  }
}

interface InternalState {
  readonly tripId: string;
  readonly dismissed: boolean;
}

export function AssumptionsBanner({ tripId }: Props): React.ReactElement | null {
  // Derive-state-from-props pattern: track the tripId alongside the
  // dismissal flag so a navigation between trip details resets the banner
  // for the new trip without setState-in-effect.
  const [state, setState] = useState<InternalState>(() => ({
    tripId,
    dismissed: isDismissed(tripId),
  }));

  if (state.tripId !== tripId) {
    setState({ tripId, dismissed: isDismissed(tripId) });
  }

  if (state.dismissed) return null;

  return (
    <Alert className="relative pe-10">
      <Info aria-hidden />
      <AlertTitle>Planning assumptions</AlertTitle>
      <AlertDescription>
        <ul className="list-disc ps-4">
          {TRIP_ASSUMPTIONS.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss assumptions banner"
        className="absolute top-1 right-1"
        onClick={() => {
          persistDismissal(tripId);
          setState({ tripId, dismissed: true });
        }}
      >
        <X data-icon aria-hidden />
      </Button>
    </Alert>
  );
}

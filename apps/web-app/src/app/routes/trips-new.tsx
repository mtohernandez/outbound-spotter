import { Map } from "lucide-react";

export function TripsNewRoute(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Map className="text-muted-foreground/50 size-16" aria-hidden />
      <h2 className="font-display text-xl font-medium tracking-tight">
        Your route + log sheets will appear here
      </h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Fill the form in the panel on the left — current location, pickup, dropoff, and cycle hours
        used. Submit to see the routed map and FMCSA Daily Log Sheets.
      </p>
    </div>
  );
}

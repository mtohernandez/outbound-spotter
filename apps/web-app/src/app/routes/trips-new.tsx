import { TripInputForm } from "@/features/trip-planner/components/trip-input-form";

export function TripsNewRoute(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-medium tracking-tight">Plan a trip</h1>
        <p className="text-muted-foreground text-sm">
          Enter your current location, pickup, dropoff, and cycle hours used. We&rsquo;ll generate
          an HOS-compliant route and the daily log sheets.
        </p>
      </header>
      <TripInputForm />
    </div>
  );
}

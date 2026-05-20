import { zodResolver } from "@hookform/resolvers/zod";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Button } from "@outbound/ui/components/ui/button";
import { FieldGroup } from "@outbound/ui/components/ui/field";
import { useForm } from "react-hook-form";

import { usePlanTrip } from "@/features/trip-planner/api/plan-trip";
import { AddressField } from "@/features/trip-planner/components/address-field";
import { CycleHoursField } from "@/features/trip-planner/components/cycle-hours-field";
import { StartAtField } from "@/features/trip-planner/components/start-at-field";
import {
  emptyResolvedAddress,
  tripInputSchema,
  type TripInput,
} from "@/features/trip-planner/schemas/trip-input";
import { roundUpToNext15Min } from "@/features/trip-planner/utils/round-time";

export function TripInputForm(): React.ReactElement {
  const planTrip = usePlanTrip();

  const form = useForm<TripInput>({
    resolver: zodResolver(tripInputSchema),
    mode: "onBlur",
    defaultValues: {
      current: emptyResolvedAddress,
      pickup: emptyResolvedAddress,
      dropoff: emptyResolvedAddress,
      cycleHoursUsed: 0,
      startAt: roundUpToNext15Min(new Date()).toISOString(),
    },
  });

  const isSubmitting = planTrip.isPending;

  function onSubmit(values: TripInput): void {
    planTrip.mutate(values);
  }

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <AddressField
          control={form.control}
          name="current"
          label="Current location"
          placeholder="Where you are now"
        />
        <AddressField
          control={form.control}
          name="pickup"
          label="Pickup"
          description="1 hour on-duty stop"
          placeholder="Where you'll pick up the load"
        />
        <AddressField
          control={form.control}
          name="dropoff"
          label="Dropoff"
          description="1 hour on-duty stop"
          placeholder="Where you'll deliver the load"
        />
        <CycleHoursField control={form.control} />
        <StartAtField control={form.control} />
      </FieldGroup>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-10 w-full"
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <SpotterLoader size="sm" aria-hidden />
            <span>Saving trip…</span>
          </>
        ) : (
          "Plan trip"
        )}
      </Button>
    </form>
  );
}

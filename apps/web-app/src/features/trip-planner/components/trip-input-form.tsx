import { zodResolver } from "@hookform/resolvers/zod";
import { SpotterLoader } from "@outbound/ui/components/brand/spotter-loader";
import { Button } from "@outbound/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@outbound/ui/components/ui/card";
import { FieldGroup } from "@outbound/ui/components/ui/field";
import { useForm } from "react-hook-form";

import { usePlanTrip } from "@/features/trip-planner/api/plan-trip";
import { AddressField } from "@/features/trip-planner/components/address-field";
import { CycleHoursField } from "@/features/trip-planner/components/cycle-hours-field";
import {
  emptyResolvedAddress,
  tripInputSchema,
  type TripInput,
} from "@/features/trip-planner/schemas/trip-input";

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
    },
  });

  const isSubmitting = planTrip.isPending;
  const submitDisabled = isSubmitting;

  function onSubmit(values: TripInput): void {
    planTrip.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New trip</CardTitle>
        <CardDescription>
          Property-carrying CMV · 70-hour / 8-day · no adverse conditions.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          void form.handleSubmit(onSubmit)(event);
        }}
        noValidate
      >
        <CardContent>
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
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            disabled={submitDisabled}
            className="h-12 sm:h-10"
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
        </CardFooter>
      </form>
    </Card>
  );
}

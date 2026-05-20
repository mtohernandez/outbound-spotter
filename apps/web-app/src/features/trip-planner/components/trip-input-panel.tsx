import { SidebarContent, SidebarHeader } from "@outbound/ui/components/ui/sidebar";

import { TripInputForm } from "@/features/trip-planner/components/trip-input-form";

export function TripInputPanel(): React.ReactElement {
  return (
    <>
      <SidebarHeader className="gap-1 border-b p-4">
        <h2 className="font-display text-base font-medium tracking-tight">Plan a trip</h2>
        <p className="text-muted-foreground text-xs">
          Property-carrying CMV · 70-hour / 8-day · no adverse conditions.
        </p>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <TripInputForm />
      </SidebarContent>
    </>
  );
}

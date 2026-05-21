import { PLANNING_DISCLAIMER } from "@/config/strings";

export function PlanningDisclaimer(): React.ReactElement {
  return (
    <p className="text-muted-foreground text-xs leading-snug" data-testid="planning-disclaimer">
      {PLANNING_DISCLAIMER}
    </p>
  );
}

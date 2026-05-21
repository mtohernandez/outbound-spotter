import { Tooltip, TooltipContent, TooltipTrigger } from "@outbound/ui/components/ui/tooltip";

import { STOP_KIND_META } from "@/features/trip-planner/components/map/stop-kind-labels";
import type { StopKind } from "@/features/trip-planner/schemas/trip-plan";

interface Props {
  readonly kind: StopKind;
  readonly children: React.ReactNode;
  /** Force-open the tooltip (test seam only). */
  readonly defaultOpen?: boolean;
}

/**
 * Wrap any stop affordance (icon, badge, row trigger) to surface the §395 or
 * assignment-brief explanation on hover/focus. The inline reason text on the
 * stops list still renders for sighted users; this tooltip is the keyboard
 * + screen-reader discoverable surface for the same citation.
 */
export function WhyThisStopTooltip({ kind, children, defaultOpen }: Props): React.ReactElement {
  const reason = STOP_KIND_META[kind].reason;
  return (
    <Tooltip defaultOpen={defaultOpen}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{reason}</TooltipContent>
    </Tooltip>
  );
}

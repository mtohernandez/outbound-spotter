import { Badge } from "@outbound/ui/components/ui/badge";

import { STOP_KIND_META } from "@/features/trip-planner/components/map/stop-kind-labels";
import { STOP_TYPE_CLASSNAMES } from "@/features/trip-planner/components/map/stop-type-colors";
import type { TripStop } from "@/features/trip-planner/schemas/trip-plan";
import { formatDuration } from "@/features/trip-planner/utils/format-duration";
import { formatLatLon } from "@/features/trip-planner/utils/format-lat-lon";

interface Props {
  readonly stop: TripStop;
  readonly tz: string;
}

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(tz: string): Intl.DateTimeFormat {
  const cached = timeFormatterCache.get(tz);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  timeFormatterCache.set(tz, fmt);
  return fmt;
}

export function MarkerPopup({ stop, tz }: Props): React.ReactElement {
  const meta = STOP_KIND_META[stop.kind];
  const location = stop.label.trim().length > 0 ? stop.label : formatLatLon(stop.lat, stop.lon);
  const scheduled = timeFormatter(tz).format(new Date(stop.scheduled_at));

  return (
    <div className="flex min-w-44 flex-col gap-2">
      <Badge variant="outline" className={STOP_TYPE_CLASSNAMES[stop.kind]}>
        {meta.label}
      </Badge>
      <p className="text-muted-foreground text-xs leading-snug">{meta.reason}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">When</dt>
        <dd className="font-mono">{scheduled}</dd>
        <dt className="text-muted-foreground">Where</dt>
        <dd className="truncate">{location}</dd>
        <dt className="text-muted-foreground">Duration</dt>
        <dd className="font-mono">{formatDuration(stop.duration_s)}</dd>
      </dl>
    </div>
  );
}

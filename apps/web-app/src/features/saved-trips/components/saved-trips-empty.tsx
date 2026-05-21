import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { Route as RouteIcon } from "lucide-react";
import { Link } from "react-router";

import { paths } from "@/config/paths";

export function SavedTripsEmpty(): React.ReactElement {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RouteIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No saved trips yet.</EmptyTitle>
        <EmptyDescription>Plan your first trip to see it here.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to={paths.tripsNew}>Plan a trip</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

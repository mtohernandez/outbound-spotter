import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { Link } from "react-router";

import { paths } from "@/config/paths";
import { NOT_FOUND_DESCRIPTION, NOT_FOUND_TITLE } from "@/config/strings";

export function NotFoundRoute(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{NOT_FOUND_TITLE}</EmptyTitle>
          <EmptyDescription>{NOT_FOUND_DESCRIPTION}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link to={paths.tripsNew}>Plan a trip</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={paths.tripsHistory}>Saved trips</Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}

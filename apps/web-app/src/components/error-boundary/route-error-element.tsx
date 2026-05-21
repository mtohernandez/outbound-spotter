import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

import { paths } from "@/config/paths";
import {
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_TITLE,
  ROUTE_ERROR_DESCRIPTION,
  ROUTE_ERROR_TITLE,
} from "@/config/strings";

export function RouteErrorElement(): React.ReactElement {
  const error = useRouteError();
  const navigate = useNavigate();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const title = isNotFound ? NOT_FOUND_TITLE : ROUTE_ERROR_TITLE;
  const description = isNotFound ? NOT_FOUND_DESCRIPTION : ROUTE_ERROR_DESCRIPTION;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-0 flex-1 items-center justify-center p-6"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => {
                void navigate(0);
              }}
            >
              Reload
            </Button>
            <Button asChild variant="outline">
              <a href={paths.tripsNew}>Plan a trip</a>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}

import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

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
      aria-labelledby="auth-route-error-title"
      aria-describedby="auth-route-error-description"
      className="bg-background flex min-h-dvh items-center justify-center p-6"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle id="auth-route-error-title">{title}</EmptyTitle>
          <EmptyDescription id="auth-route-error-description">{description}</EmptyDescription>
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
            {/* Literal "/sign-in" rather than `paths.signIn` because the
                latter is "/sign-in/*" (the React Router child-route wildcard)
                which would be a malformed href. */}
            <Button asChild variant="outline">
              <a href="/sign-in">Sign in</a>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}

import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { reportableError } from "@outbound/ui/lib/reportable-error";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { paths } from "@/config/paths";
import { APP_ERROR_DESCRIPTION, APP_ERROR_TITLE } from "@/config/strings";

interface Props {
  readonly children: React.ReactNode;
}

function AppErrorFallback({ resetErrorBoundary }: FallbackProps): React.ReactElement {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-labelledby="app-error-title"
      aria-describedby="app-error-description"
      className="bg-background flex min-h-dvh items-center justify-center p-6"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle id="app-error-title">{APP_ERROR_TITLE}</EmptyTitle>
          <EmptyDescription id="app-error-description">{APP_ERROR_DESCRIPTION}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => {
                resetErrorBoundary();
              }}
            >
              Reload
            </Button>
            {/* Plain <a> (not <Link>): if the app shell itself crashed there is
                no router context, and we want a hard reload anyway to discard
                the in-memory state that produced the failure. */}
            <Button asChild variant="outline">
              <a href={paths.tripsNew}>Return home</a>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}

export function AppErrorBoundary({ children }: Props): React.ReactElement {
  return (
    <ErrorBoundary
      FallbackComponent={AppErrorFallback}
      onError={(error) => {
        reportableError(error, "app");
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

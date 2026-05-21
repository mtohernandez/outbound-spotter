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
            {/* Literal "/sign-in" so the user has a recovery action even when
                the auth shell is the source of the crash and resetErrorBoundary()
                cannot un-bug it. */}
            <Button asChild variant="outline">
              <a href="/sign-in">Sign in</a>
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

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
      className="bg-background flex min-h-dvh items-center justify-center p-6"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{APP_ERROR_TITLE}</EmptyTitle>
          <EmptyDescription>{APP_ERROR_DESCRIPTION}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type="button"
            onClick={() => {
              resetErrorBoundary();
            }}
          >
            Reload
          </Button>
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

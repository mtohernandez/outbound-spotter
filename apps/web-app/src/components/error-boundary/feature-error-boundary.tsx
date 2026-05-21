import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { reportableError } from "@outbound/ui/lib/reportable-error";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { FEATURE_ERROR_DESCRIPTION, FEATURE_ERROR_TITLE } from "@/config/strings";

interface Props {
  readonly children: React.ReactNode;
  readonly scope: string;
}

function FeatureErrorFallback({ resetErrorBoundary }: FallbackProps): React.ReactElement {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-0 flex-1 items-center justify-center p-4"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{FEATURE_ERROR_TITLE}</EmptyTitle>
          <EmptyDescription>{FEATURE_ERROR_DESCRIPTION}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetErrorBoundary();
            }}
          >
            Reload this section
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

export function FeatureErrorBoundary({ children, scope }: Props): React.ReactElement {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      FallbackComponent={FeatureErrorFallback}
      onReset={() => {
        reset();
      }}
      onError={(error) => {
        reportableError(error, scope);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

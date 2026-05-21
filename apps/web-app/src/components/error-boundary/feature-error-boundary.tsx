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
import { useId } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { FEATURE_ERROR_DESCRIPTION, FEATURE_ERROR_TITLE } from "@/config/strings";

interface Props {
  readonly children: React.ReactNode;
  readonly scope: string;
}

function FeatureErrorFallback({ resetErrorBoundary }: FallbackProps): React.ReactElement {
  // useId so two FeatureErrorBoundary instances on the same page (e.g., the
  // Map + Log-sheets tabs in trips-detail.tsx) don't collide on title/desc ids.
  const titleId = useId();
  const descId = useId();
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="flex min-h-0 flex-1 items-center justify-center p-4"
    >
      <Empty>
        <EmptyHeader>
          <EmptyTitle id={titleId}>{FEATURE_ERROR_TITLE}</EmptyTitle>
          <EmptyDescription id={descId}>{FEATURE_ERROR_DESCRIPTION}</EmptyDescription>
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

/**
 * Section-scoped boundary. Catches synchronous render-time failures from the
 * wrapped subtree (e.g., a malformed `plan` makes Leaflet blow up, jsPDF
 * trips on an unexpected SVG node). Query-state errors are handled at the
 * route level before this boundary mounts, so the wired
 * `useQueryErrorResetBoundary().reset()` is defensive — covers the future
 * case where a descendant `useQuery({ throwOnError: true })` lands.
 */
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

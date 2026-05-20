import { Card } from "@outbound/ui/components/ui/card";
import { cn } from "@outbound/ui/lib/utils";

import type { ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  readonly className?: string;
}

export function AuthCard({ children, className }: Props): React.ReactElement {
  return (
    <Card className={cn("border-border bg-card mx-auto w-full max-w-[28rem] shadow-sm", className)}>
      {children}
    </Card>
  );
}

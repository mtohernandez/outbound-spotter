import { Button } from "@outbound/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@outbound/ui/components/ui/empty";
import { History } from "lucide-react";
import { Link } from "react-router";

import { paths } from "@/config/paths";

export function ExportsEmpty(): React.ReactElement {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <History aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No exports yet.</EmptyTitle>
        <EmptyDescription>
          Open a trip and click Export PDF to download a §395.8 log sheet. Your exports show up here
          so you can re-download them later.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to={paths.tripsHistory}>Browse saved trips</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

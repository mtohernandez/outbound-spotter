import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@outbound/ui/components/ui/alert-dialog";
import { Button } from "@outbound/ui/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { useDeleteExportRecord } from "@/features/exports/api/delete-export";

export interface DeleteExportDialogProps {
  readonly exportId: string;
  readonly routeLabel: string;
}

export function DeleteExportDialog({
  exportId,
  routeLabel,
}: DeleteExportDialogProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const mutation = useDeleteExportRecord();

  function handleConfirm(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    mutation.mutate(
      { id: exportId },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove export record for ${routeLabel}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Trash2 data-icon aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this export from history?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes this record only. Your downloaded PDF on disk is unaffected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={handleConfirm}
          >
            {mutation.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

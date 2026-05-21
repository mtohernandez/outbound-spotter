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

import { useDeleteTrip } from "@/features/saved-trips/api/delete-trip";

export interface DeleteTripDialogProps {
  readonly tripId: string;
  readonly routeLabel: string;
}

export function DeleteTripDialog({
  tripId,
  routeLabel,
}: DeleteTripDialogProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const mutation = useDeleteTrip();

  function handleConfirm(event: React.MouseEvent<HTMLButtonElement>): void {
    // Default action closes the dialog before mutation completes; manual close
    // happens in onSuccess so the dialog stays open if the request errors.
    event.preventDefault();
    mutation.mutate(
      { id: tripId },
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
          aria-label={`Delete trip ${routeLabel}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the trip and all of its log entries. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          {/* Wrap with asChild so the action button uses the canonical
              destructive variant (theme tokens via buttonVariants) instead of
              raw bg-* classes. */}
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={mutation.isPending} onClick={handleConfirm}>
              {mutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

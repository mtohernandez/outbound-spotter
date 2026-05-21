import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { server } from "@/testing/setup";

import type { ReactNode } from "react";

const clerk = buildClerkMocks();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const { DeleteTripDialog } = await import("@/features/saved-trips/components/delete-trip-dialog");

function makeWrapper(): (props: { children: ReactNode }) => ReactNode {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("DeleteTripDialog", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it("opens the dialog on trigger click and exposes a title + description for a11y", async () => {
    const user = userEvent.setup();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeleteTripDialog tripId="trip-1" routeLabel="Richmond → Newark" />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "Delete trip Richmond → Newark" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
    expect(
      screen.getByText(/This will permanently delete the trip and all of its log entries/),
    ).toBeInTheDocument();
  });

  it("closes on Cancel and does not fire the mutation", async () => {
    const user = userEvent.setup();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeleteTripDialog tripId="trip-1" routeLabel="Richmond → Newark" />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "Delete trip Richmond → Newark" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("calls the delete mutation and toasts success on Confirm", async () => {
    const user = userEvent.setup();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <DeleteTripDialog tripId="trip-1" routeLabel="Richmond → Newark" />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: "Delete trip Richmond → Newark" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Trip deleted");
    });
  });
});

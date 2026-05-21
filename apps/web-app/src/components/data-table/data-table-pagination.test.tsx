import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";

describe("DataTablePagination", () => {
  it("disables Previous on page 1 and Next on the last page", () => {
    render(
      <DataTablePagination pageIndex={0} pageCount={1} onPrevious={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it("enables both buttons on a middle page", () => {
    render(
      <DataTablePagination pageIndex={1} pageCount={3} onPrevious={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
  });

  it("fires onPrevious and onNext callbacks on click", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTablePagination pageIndex={1} pageCount={3} onPrevious={onPrevious} onNext={onNext} />,
    );

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("renders Page 0 of 1 when pageCount is 0 (empty state shouldn't usually mount this)", () => {
    render(
      <DataTablePagination pageIndex={0} pageCount={0} onPrevious={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByText(/Page 0 of 1/)).toBeInTheDocument();
  });
});

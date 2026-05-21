import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogSheetFooter } from "@/features/log-sheet/components/log-sheet-footer";
import { createEmptyMetadata } from "@/features/log-sheet/types/sheet-metadata";

function renderFooter(overrides: Partial<Parameters<typeof LogSheetFooter>[0]> = {}) {
  const onMetadataChange = vi.fn();
  const props = {
    idPrefix: "sheet-1",
    driverLegalName: "Jane Driver",
    metadata: createEmptyMetadata(),
    onMetadataChange,
    ...overrides,
  };
  render(
    <TooltipProvider>
      <LogSheetFooter {...props} />
    </TooltipProvider>,
  );
  return { onMetadataChange, props };
}

describe("LogSheetFooter", () => {
  it("renders the Shipping Documents header", () => {
    renderFooter();
    expect(screen.getByRole("heading", { name: /Shipping Documents/i })).toBeInTheDocument();
  });

  it("renders editable Pro/Shipping # and Shipper & Commodity fields", () => {
    renderFooter();
    expect(screen.getByLabelText("Pro or Shipping number")).toBeInTheDocument();
    expect(screen.getByLabelText("Shipper and commodity")).toBeInTheDocument();
  });

  it("renders the FMCSA time-standard literal", () => {
    renderFooter();
    expect(screen.getByText(/Use time standard of home terminal\./i)).toBeInTheDocument();
  });

  it("renders the recap placeholder trigger as a button (so Tooltip is keyboard reachable)", () => {
    renderFooter();
    const trigger = screen.getByRole("button", { name: /Recap.*see app summary/i });
    expect(trigger).toBeInTheDocument();
  });

  it("the recap trigger is keyboard reachable (focusable button)", () => {
    renderFooter();
    const trigger = screen.getByRole("button", { name: /Recap.*see app summary/i });
    trigger.focus();
    expect(trigger).toHaveFocus();
  });

  it("invokes onMetadataChange when shipping doc # changes", async () => {
    const user = userEvent.setup();
    const { onMetadataChange, props } = renderFooter();
    await user.type(screen.getByLabelText("Pro or Shipping number"), "P");
    expect(onMetadataChange).toHaveBeenCalledWith({ ...props.metadata, shippingDocNumber: "P" });
  });

  it("renders the I-certify checkbox + signature field via the SignatureField composite", () => {
    renderFooter();
    expect(
      screen.getByRole("checkbox", { name: /I certify that these entries are true/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Signature")).toBeInTheDocument();
  });
});

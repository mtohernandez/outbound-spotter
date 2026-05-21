import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SignatureField } from "@/features/log-sheet/components/signature-field";

describe("SignatureField", () => {
  it("renders the I-certify checkbox + signature input with correct labels", () => {
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride=""
        iCertify={false}
        onCertifyChange={() => undefined}
        onSignatureOverrideChange={() => undefined}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /i certify that these entries are true and correct/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Signature")).toBeInTheDocument();
  });

  it("guides the user to check the I-certify gate when unchecked", () => {
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride=""
        iCertify={false}
        onCertifyChange={() => undefined}
        onSignatureOverrideChange={() => undefined}
      />,
    );
    expect(screen.getByText(/Check .* to record this signature/i)).toBeInTheDocument();
  });

  it("shows the driver legal name when certified and no override", () => {
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride=""
        iCertify={true}
        onCertifyChange={() => undefined}
        onSignatureOverrideChange={() => undefined}
      />,
    );
    expect(screen.getByText("Will print as: Jane Driver")).toBeInTheDocument();
  });

  it("shows the override when certified and override is set", () => {
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride="J. M. Driver"
        iCertify={true}
        onCertifyChange={() => undefined}
        onSignatureOverrideChange={() => undefined}
      />,
    );
    expect(screen.getByText("Will print as: J. M. Driver")).toBeInTheDocument();
  });

  it("calls onCertifyChange when checkbox toggled", async () => {
    const onCertifyChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride=""
        iCertify={false}
        onCertifyChange={onCertifyChange}
        onSignatureOverrideChange={() => undefined}
      />,
    );
    await user.click(
      screen.getByRole("checkbox", { name: /i certify that these entries are true and correct/i }),
    );
    expect(onCertifyChange).toHaveBeenCalledWith(true);
  });

  it("calls onSignatureOverrideChange as the driver types", async () => {
    const onSignatureOverrideChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride=""
        iCertify={true}
        onCertifyChange={() => undefined}
        onSignatureOverrideChange={onSignatureOverrideChange}
      />,
    );
    await user.type(screen.getByLabelText("Signature"), "J");
    expect(onSignatureOverrideChange).toHaveBeenLastCalledWith("J");
  });

  it("renders the signature input as italic / font-display (no full box)", () => {
    render(
      <SignatureField
        idPrefix="sheet-1"
        driverLegalName="Jane Driver"
        signatureOverride=""
        iCertify={true}
        onCertifyChange={() => undefined}
        onSignatureOverrideChange={() => undefined}
      />,
    );
    const input = screen.getByLabelText("Signature");
    expect(input).toHaveClass("italic", "font-display", "border-0", "border-b", "bg-transparent");
  });
});

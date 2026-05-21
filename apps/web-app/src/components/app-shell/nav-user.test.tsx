import { SidebarProvider } from "@outbound/ui/components/ui/sidebar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";

const clerk = buildClerkMocks({
  firstName: "Jane",
  lastName: "Driver",
  email: "jane.driver@example.com",
});

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { NavUser } = await import("@/components/app-shell/nav-user");

describe("NavUser", () => {
  it("exposes a single, semantic accessible name on the trigger button", () => {
    // Pre-fix regression: the Avatar's `alt` + the two visible text spans
    // each contributed to the accessible name, so screen readers heard
    // "Jane Driver jane.driver@example.com Jane Driver jane.driver@example.com".
    // `aria-label` on the trigger + `aria-hidden` on the visual children
    // collapses the SR experience to one named call to action.
    render(
      <SidebarProvider>
        <NavUser />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button", { name: /account menu, jane driver/i });
    expect(trigger).toBeInTheDocument();
    // The accessible name should be exactly the aria-label, not the
    // children-walked concatenation.
    expect(trigger.getAttribute("aria-label")).toBe("Account menu, Jane Driver");
  });

  it("marks the visual children aria-hidden so they don't duplicate the SR name", () => {
    render(
      <SidebarProvider>
        <NavUser />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button", { name: /account menu/i });
    // Every direct visual element under the trigger is hidden from AT.
    const hiddenChildren = trigger.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenChildren.length).toBeGreaterThanOrEqual(3); // Avatar + name/email wrapper + chevron icon
  });
});

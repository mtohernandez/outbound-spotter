import { SidebarProvider } from "@outbound/ui/components/ui/sidebar";
import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { AppSidebar } = await import("@/components/app-shell/app-sidebar");

function renderAt(pathname: string): void {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe("AppSidebar — Saved trips nav item", () => {
  it("renders the Saved trips link with the right href", () => {
    renderAt("/trips/new");

    const link = screen.getByRole("link", { name: /Saved trips/ });
    expect(link).toHaveAttribute("href", "/trips");
  });

  it("marks Saved trips active on /trips (list)", () => {
    renderAt("/trips");

    const link = screen.getByRole("link", { name: /Saved trips/ });
    // shadcn SidebarMenuButton mirrors `isActive` onto `data-active` on the host element.
    expect(link).toHaveAttribute("data-active", "true");
  });

  it("marks Saved trips active on /trips/<id> (detail) and New trip inactive", () => {
    renderAt("/trips/00000000-0000-4000-8000-000000000001");

    const saved = screen.getByRole("link", { name: /Saved trips/ });
    const newTrip = screen.getByRole("link", { name: /New trip/ });
    expect(saved).toHaveAttribute("data-active", "true");
    expect(newTrip).toHaveAttribute("data-active", "false");
  });

  it("flips active state to New trip on /trips/new", () => {
    renderAt("/trips/new");

    const saved = screen.getByRole("link", { name: /Saved trips/ });
    const newTrip = screen.getByRole("link", { name: /New trip/ });
    expect(saved).toHaveAttribute("data-active", "false");
    expect(newTrip).toHaveAttribute("data-active", "true");
  });
});

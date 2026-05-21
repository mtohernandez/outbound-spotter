import { Separator } from "@outbound/ui/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@outbound/ui/components/ui/sidebar";
import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { useEffect } from "react";
import { Outlet, useMatches } from "react-router";

import { AppClock } from "@/components/app-shell/app-clock";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { RequireAuth } from "@/components/require-auth";

import type { CSSProperties } from "react";

export interface RouteHandle {
  readonly Secondary?: React.ComponentType;
  readonly title?: string;
}

const SIDEBAR_STYLE = { "--sidebar-width": "22rem" } as CSSProperties;

function useRouteHandle(): RouteHandle | undefined {
  const matches = useMatches();
  return matches.findLast((match): match is typeof match & { handle: RouteHandle } => {
    const h = match.handle as RouteHandle | undefined;
    return h !== undefined;
  })?.handle;
}

function AppShellInner(): React.ReactElement {
  const handle = useRouteHandle();
  const { isMobile, setOpen } = useSidebar();
  const Secondary = handle?.Secondary;
  const title = handle?.title;
  const hasSecondary = Secondary !== undefined;

  // Couple the desktop sidebar's open state to whether the active route owns a
  // Secondary panel. On routes that don't (/trips list, future settings, …) the
  // secondary slot would otherwise sit empty consuming ~19rem of viewport. The
  // manual toggle still works as a per-route override — navigation re-evaluates.
  useEffect(() => {
    if (!isMobile) setOpen(hasSecondary);
  }, [hasSecondary, isMobile, setOpen]);

  return (
    <>
      <AppSidebar Secondary={isMobile ? undefined : Secondary} />
      <SidebarInset>
        <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-3 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          {title ? <span className="font-display text-sm font-medium">{title}</span> : null}
          <div className="ms-auto">
            <AppClock />
          </div>
        </header>
        {isMobile && Secondary ? (
          <div className="max-h-[38vh] overflow-y-auto border-b">
            <Secondary />
          </div>
        ) : null}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </>
  );
}

export function AppShellLayout(): React.ReactElement {
  return (
    <RequireAuth>
      <TooltipProvider delayDuration={200}>
        <SidebarProvider style={SIDEBAR_STYLE}>
          <AppShellInner />
        </SidebarProvider>
      </TooltipProvider>
    </RequireAuth>
  );
}

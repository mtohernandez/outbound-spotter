import { Separator } from "@outbound/ui/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@outbound/ui/components/ui/sidebar";
import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { Outlet } from "react-router";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { RequireAuth } from "@/components/require-auth";

export function AppShellLayout(): React.ReactElement {
  return (
    <RequireAuth>
      <TooltipProvider delayDuration={200}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex h-12 items-center gap-2 border-b px-3 backdrop-blur">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              {/* Breadcrumb gets populated by child routes via a future portal; */}
              {/* for spec 03 the trip workspace title carries the location. */}
            </header>
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </RequireAuth>
  );
}

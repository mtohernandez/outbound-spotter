import { BrandMark } from "@outbound/ui/components/brand/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@outbound/ui/components/ui/sidebar";
import { History, Plus } from "lucide-react";
import { Link, useLocation } from "react-router";

import { NavUser } from "@/components/app-shell/nav-user";
import { paths } from "@/config/paths";

export function AppSidebar(): React.ReactElement {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const location = useLocation();
  const isNewTripActive = location.pathname === paths.tripsNew;

  return (
    <Sidebar collapsible="icon" data-testid="app-sidebar">
      <SidebarHeader className="px-2 pt-3 pb-2">
        <div className="flex h-8 items-center px-1">
          {isCollapsed ? (
            <BrandMark variant="icon" className="size-6" />
          ) : (
            <BrandMark className="text-foreground h-6 w-auto" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="New trip" isActive={isNewTripActive}>
                  <Link to={paths.tripsNew}>
                    <Plus />
                    <span>New trip</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Saved trips — coming soon"
                  disabled
                  aria-disabled
                  className="cursor-not-allowed opacity-50"
                >
                  <History />
                  <span>Saved trips</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

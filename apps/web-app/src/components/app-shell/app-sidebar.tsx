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
            <BrandMarkIcon className="text-primary size-6" aria-label="Outbound Spotter" />
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

function BrandMarkIcon({ className, ...props }: React.SVGProps<SVGSVGElement>): React.ReactElement {
  return (
    <svg
      viewBox="0 0 73 73"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      className={className}
      {...props}
    >
      <path
        d="M36.6 88.3c-4.8 0-9.2-.8-13.2-2.4-4-1.7-7.5-4-10.5-6.9-3-2.9-5.3-6.4-7-10.3-1.6-3.9-2.4-8.2-2.4-12.8 0-4.6.8-8.9 2.4-12.8 1.7-3.9 4-7.4 7-10.3 3-2.9 6.5-5.2 10.5-6.8 4-1.7 8.4-2.5 13.2-2.5s9.2.8 13.2 2.5c4 1.6 7.5 4 10.5 6.9 3 3 5.3 6.4 6.9 10.3 1.7 3.9 2.5 8.2 2.5 12.7 0 4.6-.8 8.8-2.5 12.8-1.6 3.9-3.9 7.4-6.9 10.3-3 2.9-6.5 5.2-10.5 6.9-4 1.6-8.4 2.4-13.2 2.4z"
        transform="translate(-3 -22)"
        fill="currentColor"
      />
      <circle cx="36.4" cy="33.1" r="20.5" fill="var(--red-500)" />
    </svg>
  );
}

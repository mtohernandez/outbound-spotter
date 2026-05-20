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
} from "@outbound/ui/components/ui/sidebar";
import { History, Plus } from "lucide-react";
import { Link, useLocation } from "react-router";

import { NavUser } from "@/components/app-shell/nav-user";
import { paths } from "@/config/paths";

interface Props {
  readonly Secondary?: React.ComponentType;
}

export function AppSidebar({ Secondary }: Props): React.ReactElement {
  const location = useLocation();
  const isNewTripActive = location.pathname === paths.tripsNew;

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      data-testid="app-sidebar"
    >
      <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <Link to={paths.tripsNew satisfies string}>
                  <div className="text-primary flex aspect-square size-8 items-center justify-center">
                    <BrandMark variant="icon" className="size-6" />
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={{ children: "New trip", hidden: false }}
                    isActive={isNewTripActive}
                    className="px-2.5 md:px-2"
                  >
                    <Link to={paths.tripsNew satisfies string}>
                      <Plus />
                      <span>New trip</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={{ children: "Saved trips — coming soon", hidden: false }}
                    disabled
                    aria-disabled
                    className="cursor-not-allowed px-2.5 opacity-50 md:px-2"
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
          <NavUser />
        </SidebarFooter>
      </Sidebar>

      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        {Secondary ? <Secondary /> : null}
      </Sidebar>
    </Sidebar>
  );
}

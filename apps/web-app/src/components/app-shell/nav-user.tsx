import { useAuth, useUser } from "@clerk/react";
import { ThemeToggle } from "@outbound/ui/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@outbound/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@outbound/ui/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@outbound/ui/components/ui/sidebar";
import { ChevronsUpDown, LogOut } from "lucide-react";

import { env } from "@/config/env";

export function NavUser(): React.ReactElement | null {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const { isMobile } = useSidebar();

  if (!isLoaded || !user) {
    return null;
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const displayName = fullName !== "" ? fullName : email !== "" ? email : "Driver";
  const initials = computeInitials(user.firstName, user.lastName, email);

  async function handleSignOut(): Promise<void> {
    await signOut();
    window.location.assign(env.VITE_AUTH_SIGN_IN_URL);
  }

  // Trigger gets a single, semantic accessible name. Without `aria-label`,
  // screen readers walk the Avatar's `alt` + the two visible text spans and
  // announce the user's display name three times in a row (the side effect of
  // the shadcn sidebar-09 reference layout). Marking the visual children
  // `aria-hidden` collapses the SR experience to "Account menu, {displayName}"
  // while leaving the sighted UI intact.
  const triggerLabel = `Account menu, ${displayName}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          aria-label={triggerLabel}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:h-8 md:p-0"
        >
          <Avatar className="size-8 rounded-lg" aria-hidden>
            {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight" aria-hidden>
            <span className="truncate font-medium">{displayName}</span>
            <span className="text-muted-foreground truncate text-xs">{email}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg" aria-hidden>
              {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="text-muted-foreground truncate text-xs">{email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            // Keep the dropdown open after toggling so the user can confirm
            // the theme change before dismissing.
            event.preventDefault();
          }}
          className="flex items-center justify-between"
        >
          <span>Theme</span>
          <ThemeToggle />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function computeInitials(firstName: string | null, lastName: string | null, email: string): string {
  const first = firstName?.charAt(0).toUpperCase() ?? "";
  const last = lastName?.charAt(0).toUpperCase() ?? "";
  if (first || last) {
    return `${first}${last}` || "D";
  }
  const localPart = email.split("@")[0] ?? "";
  return localPart.slice(0, 2).toUpperCase() || "D";
}

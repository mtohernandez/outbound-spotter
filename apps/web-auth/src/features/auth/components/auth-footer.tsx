import type { MouseEvent } from "react";

const links = [
  { label: "Privacy", href: "#privacy" },
  { label: "Terms", href: "#terms" },
] as const;

export function AuthFooter(): React.ReactElement {
  const year = new Date().getFullYear();
  const onPreventNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  return (
    <footer className="text-muted-foreground border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs">
      <p>© {year} Outbound Spotter</p>
      <nav aria-label="Legal" className="flex items-center gap-4">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={onPreventNavigation}
            className="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}

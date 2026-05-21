export function AuthFooter(): React.ReactElement {
  const year = new Date().getFullYear();

  return (
    <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
      <span>Privacy</span>
      <span aria-hidden="true">·</span>
      <span>Terms</span>
      <span aria-hidden="true">·</span>
      <span>© {year} Outbound Spotter</span>
    </footer>
  );
}

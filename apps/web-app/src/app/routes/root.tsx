export function RootRoute(): React.ReactElement {
  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center">
      <section className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">Outbound Spotter</h1>
        <p className="text-muted-foreground text-sm">
          Web app shell is up. Features land via specs.
        </p>
      </section>
    </main>
  );
}

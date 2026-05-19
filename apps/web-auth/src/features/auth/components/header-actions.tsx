import { BrandMark } from "@outbound/ui/components/brand/brand-mark";
import { ThemeToggle } from "@outbound/ui/components/theme/theme-toggle";

export function HeaderActions(): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <BrandMark className="h-8 w-auto" />
      <ThemeToggle />
    </div>
  );
}

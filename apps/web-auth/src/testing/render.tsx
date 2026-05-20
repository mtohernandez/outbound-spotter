import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import type { ReactElement } from "react";

interface Options extends RenderOptions {
  readonly initialEntries?: string[];
}

export function renderWithProviders(ui: ReactElement, options: Options = {}): RenderResult {
  const { initialEntries = ["/"], ...rtlOptions } = options;
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ThemeProvider>
    ),
    ...rtlOptions,
  });
}

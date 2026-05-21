import { ThemeProvider } from "@outbound/ui/components/theme/theme-provider";
import { TooltipProvider } from "@outbound/ui/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import type { ReactElement } from "react";

interface Options extends RenderOptions {
  readonly initialEntries?: string[];
  readonly routePath?: string;
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, options: Options = {}): RenderResult {
  const { initialEntries = ["/"], routePath, ...rtlOptions } = options;
  const client = createTestQueryClient();
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider defaultTheme="light">
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <MemoryRouter initialEntries={initialEntries}>
              {routePath === undefined ? (
                children
              ) : (
                <Routes>
                  <Route path={routePath} element={children} />
                </Routes>
              )}
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    ),
    ...rtlOptions,
  });
}

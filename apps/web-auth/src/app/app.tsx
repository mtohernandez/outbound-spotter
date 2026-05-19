import { AppProvider } from "@/app/provider";
import { AppRouter } from "@/app/router";

export function App(): React.ReactElement {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}

import { AppProvider } from "@/app/provider";
import { Redirector } from "@/features/redirect/components/redirector";

export function App(): React.ReactElement {
  return (
    <AppProvider>
      <Redirector />
    </AppProvider>
  );
}

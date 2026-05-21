import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Lazy-loading via `React.lazy(() => import("./trip-map"))` is sufficient
  // to keep leaflet out of the entry chunk: Vite/Rolldown emits a dedicated
  // chunk for the dynamic-import boundary AND its transitive node_modules
  // (leaflet + react-leaflet + @react-leaflet/core). A previously-tried
  // manualChunks carve-out for "leaflet-vendor" caused Rolldown to hoist
  // shared deps (react, scheduler) into the leaflet chunk via cross-chunk
  // imports — the worst-of-both-worlds. The natural split is correct.
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});

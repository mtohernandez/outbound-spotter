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
  build: {
    // Vite 8 ships rolldown; `manualChunks` accepts a function in this build. Isolating the
    // heavy, rarely-changing dependencies into their own chunks lets long-term browser caching
    // skip them on the next deploy.
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("/node_modules/@clerk/")) return "clerk";
          if (id.includes("/node_modules/@zxcvbn-ts/")) return "zxcvbn";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router/")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
});

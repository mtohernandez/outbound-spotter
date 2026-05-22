import { reactConfig } from "@outbound/eslint-config/react";

const BULLETPROOF_ZONES = [
  { target: "./src/components", from: ["./src/features", "./src/app"] },
  { target: "./src/hooks", from: ["./src/features", "./src/app"] },
  { target: "./src/lib", from: ["./src/features", "./src/app"] },
  { target: "./src/types", from: ["./src/features", "./src/app"] },
  { target: "./src/utils", from: ["./src/features", "./src/app"] },
  { target: "./src/stores", from: ["./src/features", "./src/app"] },
  { target: "./src/config", from: ["./src/features", "./src/app"] },
  { target: "./src/features", from: "./src/app" },
];

export default [
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/features/redirect/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...BULLETPROOF_ZONES,
            {
              target: "./src/features/redirect",
              from: "./src/features",
              except: ["./redirect"],
              message:
                "Features may not import from sibling features. Lift shared code to src/components, src/hooks, src/lib, or a packages/* workspace.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist", "coverage", "node_modules", ".turbo", ".vercel"],
  },
];

import { reactConfig } from "@outbound/eslint-config/react";

// Bulletproof React feature zones — re-stated here so we can grant `trip-planner` an `except`
// to import from itself. The package-level rule treats every `src/features/*` file as unable to
// import from `src/features`, which is correct for cross-feature but blocks intra-feature alias
// imports.
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
    files: ["src/features/trip-planner/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...BULLETPROOF_ZONES,
            {
              target: "./src/features/trip-planner",
              from: "./src/features",
              except: ["./trip-planner"],
              message:
                "Features may not import from sibling features. Lift shared code to src/components, src/hooks, src/lib, or a packages/* workspace.",
            },
          ],
        },
      ],
    },
  },
  {
    // log-sheet (spec 08) is allowed to import from trip-planner one-way: TripPlan / TripResponse
    // zod types and the formatLatLon util. The reverse direction is still blocked by the
    // trip-planner block above. This mirrors spec 03's carve-out shape.
    files: ["src/features/log-sheet/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...BULLETPROOF_ZONES,
            {
              target: "./src/features/log-sheet",
              from: "./src/features",
              except: ["./log-sheet", "./trip-planner"],
              message:
                "Features may not import from sibling features. log-sheet may consume trip-planner schemas and the formatLatLon util; everything else lifts to src/components, src/hooks, src/lib, or a packages/* workspace.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist", "coverage", "node_modules", ".turbo"],
  },
];

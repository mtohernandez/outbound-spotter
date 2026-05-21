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
    files: ["src/features/saved-trips/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...BULLETPROOF_ZONES,
            {
              target: "./src/features/saved-trips",
              from: "./src/features",
              except: ["./saved-trips", "./trip-planner"],
              message:
                "Features may not import from sibling features. saved-trips may consume trip-planner utils and query keys; everything else lifts to src/components, src/hooks, src/lib, or a packages/* workspace.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/pdf-export/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...BULLETPROOF_ZONES,
            {
              target: "./src/features/pdf-export",
              from: "./src/features",
              except: ["./pdf-export", "./log-sheet", "./trip-planner"],
              message:
                "Features may not import from sibling features. pdf-export may consume log-sheet (the DailyLogSheet SVG id contract + grid geometry constants) and trip-planner (LogDay + TripPlan schemas + useTripPlan); everything else lifts to src/components, src/hooks, src/lib, or a packages/* workspace.",
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

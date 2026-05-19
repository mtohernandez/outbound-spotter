/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "style",
        "revert",
      ],
    ],
    "scope-enum": [
      1,
      "always",
      [
        // app scopes
        "web-app",
        "web-auth",
        "web-api",
        // package scopes
        "eslint-config",
        "typescript-config",
        "ui",
        "types",
        // surface scopes
        "hos",
        "logs",
        "trip",
        "auth",
        "map",
        "routing",
        "pdf",
        // infra scopes
        "monorepo",
        "ci",
        "deps",
        "context",
        "docs",
        "release",
      ],
    ],
    "subject-case": [2, "never", ["pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 120],
  },
};

export default config;

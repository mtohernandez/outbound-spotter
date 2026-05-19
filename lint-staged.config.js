/**
 * Run linters + formatters on staged files only.
 * Each command receives the absolute paths of staged files matching the glob.
 */
/** @type {import("lint-staged").Configuration} */
const config = {
  // TS/JS — ESLint --fix + Prettier
  // --no-warn-ignored: a file that's intentionally excluded from a project's
  // eslint.config.js (e.g. shared infra under packages/eslint-config) shouldn't
  // fail the commit. The actual linting still runs for files that ARE in scope.
  "**/*.{ts,tsx,js,jsx,mjs,cjs}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],

  // JSON / YAML / Markdown / CSS — Prettier only
  "**/*.{json,yml,yaml,md,mdx,css}": ["prettier --write"],

  // Python — Ruff lint --fix + Ruff format (no-op if uv/ruff is not installed yet)
  "**/*.py": (files) => {
    if (files.length === 0) return [];
    return [
      `uvx ruff check --fix --quiet ${files.join(" ")}`,
      `uvx ruff format --quiet ${files.join(" ")}`,
    ];
  },
};

export default config;

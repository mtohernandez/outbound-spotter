# Contributing to Outbound Spotter

Outbound Spotter is **source-available, non-commercial** software (PolyForm Noncommercial 1.0.0 — see `LICENSE.md`). By opening a pull request you confirm that you have the right to contribute the code and that your contribution is licensed under the same terms.

This document is the canonical contribution flow. Every change — feature, fix, refactor, docs — follows it. The flow is enforced by Husky hooks (locally) and CI (`/.github/workflows/ci.yml`); ignore it and the PR cannot merge.

## 1. Branching model — gitflow

Two long-lived branches:

- **`main`** — production. Receives merges from `develop` via release branches.
- **`develop`** — integration. Receives merges from feature / fix / chore branches via pull requests.

Per-unit branches off `develop`:

```
feat/NN-<slug>      # new functionality (NN is the next spec number)
fix/NN-<slug>       # bug fix
chore/NN-<slug>     # tooling, deps, infra
docs/NN-<slug>      # docs only
refactor/NN-<slug>  # internal change, no behavior shift
```

`NN` is the zero-padded spec number from `context/specs/`. Once specs exist, branch names mirror their spec.

**Direct pushes to `main` and `develop` are blocked by `.husky/pre-push`.** They only move via PR merges on GitHub. The initial bootstrap push of `main` + `develop` to a fresh remote is the single exception (the hook detects "no upstream yet" and allows it once).

## 2. Conventional Commits

Every commit message follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>

[optional body — explains why, not what]

[optional footer — BREAKING CHANGE: …, Closes #…]
```

Allowed types are listed in `commitlint.config.js`. Scopes are project-specific (`web-app`, `web-auth`, `web-api`, `ui`, `hos`, `logs`, `trip`, `auth`, `map`, `routing`, `pdf`, `monorepo`, `ci`, `deps`, `context`, `docs`, `release`). `commit-msg` rejects anything else.

**Hard rules**:

- No `Co-Authored-By:` trailer in any commit. Ever.
- No `--no-verify`. If a hook fails, fix the cause.
- No amending merged commits or force-pushing `main` / `develop`.
- One logical change per commit. Squash trivia locally before opening the PR.

## 3. Local validation (the pre-commit hook runs all of this on staged files)

- **TS / JS** — `eslint --fix --max-warnings=0 --no-warn-ignored` then `prettier --write`.
- **JSON / YAML / MD / CSS** — `prettier --write`.
- **Python** — `uvx ruff check --fix --quiet` then `uvx ruff format --quiet`.

Before opening the PR, run the full pipeline:

```bash
pnpm exec turbo run lint typecheck test --affected
pnpm format:check
# Python touched?
cd apps/web-api && uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest
```

The `pre-push` hook runs `turbo run typecheck --affected` + `turbo run test --affected` and refuses to push if either fails. Same checks land in CI (`.github/workflows/ci.yml`).

## 4. Pull request flow

1. Branch off `develop` with the naming convention above.
2. Make commits (Conventional Commits, atomic, no `Co-Authored-By`).
3. `git push --set-upstream origin <branch>` — the pre-push hook runs typecheck + tests.
4. `gh pr create --base develop --head <branch>` — the body is pre-filled from `.github/pull_request_template.md`. Fill every section; "N/A" is acceptable when applicable.
5. The CI workflow runs lint, typecheck, test, build, format check, and commitlint on every PR commit.
6. Invoke the relevant sub-agents per `CLAUDE.md` (`code-reviewer` is mandatory; `architect-review` / `security-auditor` / `accessibility-tester` / `performance-optimizer` are conditional on the surface you touched).
7. Once green and reviewed: `gh pr merge --merge --delete-branch` (gitflow `--no-ff` convention; preserves feature-branch history).
8. After merge, locally:
   ```bash
   git checkout develop
   git pull origin develop
   git branch -d <branch>   # local cleanup (remote already deleted by --delete-branch)
   ```

## 5. Release flow (when develop is shipping)

1. Branch `release/X.Y.Z` off `develop`, version-bump + changelog.
2. PR `release/X.Y.Z` into `main`.
3. Tag the merge commit `vX.Y.Z` on `main`.
4. Merge back into `develop` to capture the bump.

(Documented here for completeness — first release is not in scope yet.)

## 6. Env conventions

**No `.env*` files are tracked in this repo.** The root `.gitignore` ignores every shape (`.env`, `.env.local`, `.env.example`, `.env.production`, …). This applies in perpetuity — never reintroduce a template.

- **Variable names** — each app documents its required variables (with type, purpose, and which side of the wire reads them) in its `README.md`. The runtime validators are the canonical schemas: `apps/web-app/src/config/env.ts`, `apps/web-auth/src/config/env.ts`, and `apps/web-api/web_api/settings/base.py` (pydantic-settings).
- **Local dev** — create a working file the host tool reads (`.env.local` for Vite apps, `.env` for the Django app). Populate from your password manager / the deployment provider's dashboard. The file is gitignored.
- **Cloud** — set each variable in the provider's secret store: Vercel for `web-app` / `web-auth`, Fly.io for `web-api` (`fly secrets set KEY=value`).
- **Never commit secrets.** This is enforced by `.gitignore`; do not bypass it.

## 7. License acceptance

By contributing you confirm:

- You wrote the code, or you have the right to submit it under the project's license.
- Your contribution is licensed under PolyForm Noncommercial 1.0.0 (`LICENSE.md`).
- The project is source-available and **not** for commercial use. Forking for commercial reuse, hosting as a SaaS for paying customers, or reselling are not permitted by the license.

## 8. Where to find the rules of engagement

- `CLAUDE.md` — operating manual for AI-assisted work (skills, sub-agents, validation discipline).
- `context/code-standards.md` — language-level conventions (TS, Python, React, Django).
- `context/architecture.md` — invariants and pinned versions.
- `context/ui-context.md` — design tokens and component rules.
- `context/ai-workflow-rules.md` — spec workflow + sub-agent invocation matrix.
- `docs/assesment.md` — the original product brief. Anchor every decision here.

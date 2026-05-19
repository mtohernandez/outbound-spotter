<!--
  Every PR follows this template. Do not strip sections — leave "N/A" if a
  section doesn't apply. Title must be a Conventional Commit (the squash/
  merge commit message lands on develop verbatim).
  See CONTRIBUTING.md for the full flow.
-->

## Summary

<!-- 1-3 sentences: what changed and *why*. Link the spec under `context/specs/` if one exists. -->

## Type of change

<!-- Check all that apply. -->

- [ ] `feat` — new functionality
- [ ] `fix` — bug fix
- [ ] `refactor` — internal change, no behavior change
- [ ] `perf` — performance improvement
- [ ] `test` — adds or fixes tests
- [ ] `docs` — documentation only
- [ ] `chore` / `build` / `ci` — tooling, deps, pipelines
- [ ] **Breaking change** (also use `!` in commit / open under `BREAKING CHANGE:` footer)

## Linked context

<!-- Replace placeholders. Delete the line if it doesn't apply. -->

- Spec: `context/specs/NN-<slug>.md`
- Closes #
- Architecture invariant touched: <!-- e.g. #4 (no client-side HOS math) — N/A if none -->

## Validation performed

<!-- What you actually ran locally. Be specific. -->

- [ ] `pnpm exec turbo run lint typecheck test --affected` passes
- [ ] `pnpm format:check` passes
- [ ] Python touched? `uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest` passes
- [ ] UI touched? Verified in the browser at `localhost:5173` (and `5174` for web-auth)
- [ ] Versions / library APIs encoded were verified against live upstream docs (cite below)

## Citations for any new versions / APIs encoded

<!-- Cite official docs or installed source. Drop "N/A" if no new third-party fact landed. -->

-

## Sub-agent review

<!-- Per CLAUDE.md, the listed agents reviewed this diff before merge. -->

- [ ] `code-reviewer` (from `comprehensive-review`) — no unresolved CRITICAL findings
- [ ] `architect-review` — only required when invariants, boundaries, or stack pins moved
- [ ] `security-auditor` — only required for auth, JWT, ORS proxy, or env-secret changes
- [ ] `accessibility-tester` — only required for UI changes
- [ ] `performance-optimizer` — only required for routes, lists, or new data fetches

## Screenshots / recordings

<!-- For UI changes. Drop the section otherwise. -->

## Out of scope (deliberate)

<!-- What this PR is intentionally not doing, so reviewers don't ask. -->

-

## Reviewer checklist

- [ ] PR title is a valid Conventional Commit (`<type>(<scope>): <description>`).
- [ ] No `Co-Authored-By` trailer in any commit.
- [ ] No `--no-verify` was used to land any commit.
- [ ] No drift from `docs/assesment.md` (the original product brief is law).
- [ ] Context files (`context/**`) updated when architecture, scope, or standards moved.
- [ ] `context/progress-tracker.md` reflects the change (when a tracker exists).

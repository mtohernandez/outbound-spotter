# Outbound Spotter — Application Building Context

Outbound Spotter is a trip-planning web app for property-carrying interstate truck drivers operating under the **70-hour / 8-day Federal HOS schedule**. It takes current location, pickup, dropoff, and cycle-hours-used and returns a routed map plus FMCSA §395.8-compliant Daily Log Sheets.

Before implementing or making any architectural decision, read the following in order:

1. `context/project-overview.md` — product definition, goals, features, scope.
2. `context/architecture.md` — system structure, boundaries, storage model, invariants, pinned stack versions.
3. `context/ui-context.md` — theme, colors, typography, component conventions (sourced from `docs/theme.md`).
4. `context/code-standards.md` — implementation rules and conventions.
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, delivery approach.
6. `context/progress-tracker.md` — current phase, completed work, open questions, next steps.

## Source-of-truth references

- **Product brief** — `docs/assesment.md`
- **FMCSA HOS regulations (canonical for the planner)** — `docs/interstate-truck-driver-guide.md`
- **Visual language (colors, fonts, shadcn preset, animation)** — `docs/theme.md`
- **CI/CD and branching model (gitflow)** — `docs/dev-ci-cd.md`
- **Example ELD logs (golden visual targets)** — `docs/assets/example-*.png`

## Operating rules

- Update `context/progress-tracker.md` after each meaningful implementation change.
- If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file **before continuing**.
- Specs drive implementation. No code lands without a `context/specs/NN-*.md` file.
- No custom Claude Code sub-agents — all sub-agents come from the `wshobson/agents` plugin marketplace declared in `.claude/settings.json`.
- Skills live under `.agents/skills/` and are surfaced to Claude via the `.claude/skills` symlink. Install with `pnpx skills add <repo> --skill <name>`.
- The HOS planner in `apps/web-api/web_api/hos/` is a pure Python module (no Django, ORM, or HTTP imports) so it stays trivially testable. Treat that boundary as load-bearing.

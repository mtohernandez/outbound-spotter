# Outbound Spotter — Agent Operating Manual

HOS-compliant trip-planning app for property-carrying CMV drivers (70-hour / 8-day schedule). The driver enters current/pickup/dropoff + cycle hours used; the app returns a routed map and FMCSA §395.8 Daily Log Sheets. Anchor every decision on `docs/assesment.md` — do not drift.

## Read these in order before touching code

1. `context/project-overview.md` — product, scope, success criteria.
2. `context/architecture.md` — boundaries, invariants, pinned stack versions.
3. `context/ui-context.md` — OKLCH tokens, density, motion, shadcn rules.
4. `context/code-standards.md` — TS, Python, React 19, Bulletproof, Django+DRF, testing, naming.
5. `context/ai-workflow-rules.md` — spec workflow, scoping, sub-agent matrix.
6. `context/progress-tracker.md` — current phase, open questions.

## Source-of-truth references

- **Product brief (original intent — never drift)** — `docs/assesment.md`
- **FMCSA HOS regulations** — `docs/interstate-truck-driver-guide.md`
- **Visual language** — `docs/theme.md`
- **CI/CD + branching** — `docs/dev-ci-cd.md`
- **Example ELD logs** — `docs/assets/example-*.png`

## Validation discipline (the most important rule)

**Never assume an API, version, or pattern.** Library APIs drift faster than model knowledge. Before encoding any non-trivial fact:

1. Check `context/` first. If documented, trust it.
2. If not in `context/`, fetch the official docs (`WebFetch`/`WebSearch`) or read the installed source in `node_modules/` / `.venv/`.
3. Cite the source inline in the work product (URL or file path).
4. If a context file disagrees with current docs, update the context file first, then implement.

This rule is enforced retroactively by senior review. Drift kills the project.

## Skills — auto-invoked by file context

| Surface you touch                                       | Skill that should fire                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `*.tsx`, `*.ts` in any app                              | `react-architecture` (Bulletproof), `react-doctor` (React 19 rules) |
| `apps/*/vite.config.ts`, `vite.config.ts`, bundle work  | `react-vite-best-practices`                                         |
| Adding/composing shadcn primitives                      | `shadcn` (composition rules, Field/FieldGroup, sonner, data-icon)   |
| `globals.css`, `@theme inline`, dark-mode toggle        | `tailwind-theme-builder`                                            |
| Editing `turbo.json`, package tasks, `--affected`       | `turborepo`                                                         |
| `apps/web-api/**/*.py`, `settings.py`, models, viewsets | `django-expert`                                                     |
| Clerk auth flows / SDK operations                       | `clerk` (user-level)                                                |

Skills live in `.agents/skills/<name>/` and are surfaced through the `.claude/skills` symlink. Each has a `SKILL.md` with the rule of record — read it before implementing in that surface.

## Sub-agents — invoke explicitly

All sub-agents come from the `claude-code-workflows` marketplace (wshobson/agents). No custom agents are authored. Invoke by name:

| Task                                                          | Agent to invoke                                           |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| Code review against the diff before opening a PR              | `code-reviewer` (from `comprehensive-review` plugin)      |
| Architecture review — invariants, boundaries, stack decisions | `architect-review`                                        |
| Security review — auth, JWT, ORS proxy, env secrets           | `security-auditor`                                        |
| Writing or fixing tests (Pytest / Vitest)                     | `test-automator` (from `unit-testing`)                    |
| TS / React 19 idioms and refactors                            | `typescript-pro` (from `javascript-typescript`)           |
| Python / Django / DRF / ORM                                   | `python-pro` and `django-pro` (from `python-development`) |
| Accessibility (WCAG 2.2, ARIA, target sizes)                  | `ui-visual-validator` (from `accessibility-compliance`)   |
| Bundle size, render perf, query perf                          | `performance-optimizer` (from `application-performance`)  |

The marketplace + enabled plugins are declared in `.claude/settings.json#enabledPlugins`. Run `claude plugin list` to confirm they're enabled.

## Operating rules

- **Validate against live docs, not memory.** See "Validation discipline" above.
- **Specs drive implementation** once they exist (`context/specs/NN-*.md`). The current phase is foundation + scaffolding; specs land after.
- **Anchor on `docs/assesment.md`.** When in doubt about what the product is for, re-read it. Any drift gets reverted.
- **Update context files before implementing** when a decision changes architecture, scope, conventions, or tokens.
- **No custom sub-agents.** Use the wshobson plugins only. If a gap exists, file it as an Open Question in `progress-tracker.md`.
- **The HOS planner stays pure Python.** No `django` / `rest_framework` / HTTP imports inside `apps/web-api/web_api/hos/`. A CI grep enforces this.
- **The shared UI source of truth is `packages/ui`.** Apps import primitives + theme; they never re-implement.
- **Commits are conventional, no `Co-Authored-By` trailer.** Subject line is the change; body explains _why_ if needed.
- **Comments only for the WHY**, not the WHAT. Names carry meaning. No multi-paragraph docstrings unless a hidden constraint requires explanation.

## Pre-flight checklist for any non-trivial task

Before writing code:

- [ ] Read the relevant context files (above list).
- [ ] If a library version or API is involved, fetch the current upstream docs and cite the source.
- [ ] Auto-trigger or explicitly invoke the matching skill(s) from the table above.
- [ ] Plan the unit boundary (one system boundary, one verifiable result).
- [ ] Identify the sub-agent(s) that will review the work afterward.

Before committing:

- [ ] Lint + typecheck + test pass via `pnpm exec turbo run lint typecheck test --affected`.
- [ ] Format check passes (`pnpm format:check`).
- [ ] For Python touched: `uv run ruff check`, `uv run ruff format --check`, `uv run mypy`, `uv run pytest`.
- [ ] `code-reviewer` agent has been invoked on the diff (and `architect-review` if invariants moved).
- [ ] Conventional commit subject; no `Co-Authored-By` trailer; no `--no-verify`.

## Where things live (quick map)

```
outbound-spotter/
├── apps/
│   ├── web-app/    Vite + React 19 + TS — trip planner (app.<host>)
│   ├── web-auth/   Vite + React 19 + TS — Clerk auth UI (accounts.<host>, Clerk primary)
│   ├── web-apex/   Vite + React 19 + TS — apex redirector (<host>, Clerk satellite)
│   └── web-api/    Django 5.2 LTS + DRF + uv — API + HOS planner (on Vercel Python runtime)
├── packages/
│   ├── ui/                  shared shadcn primitives + @theme block (source of truth)
│   ├── eslint-config/       flat config presets (base / react / library)
│   └── typescript-config/   tsconfig presets (base / react / vite-app / library)
├── context/        the six files listed above
├── docs/           assessment, FMCSA guide, theme, CI/CD reference, example logs
├── .claude/        agents (empty, plugin-supplied), skills (symlink), settings.json
└── .agents/        skills/ — installed via `pnpx skills add`
```

Detailed conventions live in `context/`. This file is the entry point and the rules of engagement. Keep it ≤ 200 lines.

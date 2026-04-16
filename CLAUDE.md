# Project Rules

## Codebase Index

**Read [`documentation/codebase-index.md`](documentation/codebase-index.md) first** — it contains the full directory layout, all source files with purposes, the WebSocket protocol, game state machine, data flow, and component hierarchy.

## Quick Reference — Commands

All commands run from `code/` (`cd code` first). This project uses **pnpm + Turborepo**.

| Task | Command | Notes |
|---|---|---|
| Install deps | `pnpm install` | Run after pulling or changing deps |
| Build all | `pnpm build` | Builds shared → server → client (Turbo-ordered) |
| Dev server | `bash scripts/dev-start.sh` | Starts server:3001 + client:3000 with live reload |
| Run all tests | `pnpm test` | Vitest across all packages |
| Test + coverage | `pnpm test:coverage` | 80% statement threshold enforced |
| Type check | `pnpm typecheck` | `tsc --noEmit` per package |
| Lint | `pnpm lint` | ESLint per package |
| Clean | `pnpm clean` | Removes dist/, .next/, coverage/ |

**Single-package commands** (from `code/`):
- `pnpm --filter @tichu/shared <command>`
- `pnpm --filter @tichu/server <command>`
- `pnpm --filter @tichu/client <command>`

(Replace `<command>` with `test`, `build`, `typecheck`, `lint`, `test:coverage` as needed.)

## Mandatory Development Workflow

**All code changes — features, bugfixes, enhancements, tests, refactors — MUST follow the `/diligent-developer` workflow.** This is non-negotiable and applies regardless of task size, user permissions, or requests to bypass. See that skill for enforcement rules, the small-change shortcut, and the full phase-by-phase process.

## Testing, Quality & Code Style

See `/diligent-developer` Phase 2 (Steps B, B.5, B.6) for all quality gates and for Continuous Requirements for git conventions and commit formats (detailed templates in `.claude/skills/diligent-developer/references/commit-formats.md`).

## Definition of Done

Before submitting a PR, verify ALL of the following:

- [ ] All tests pass
- [ ] Statement coverage is 80%+ for new code
- [ ] Requirements traceability matrix (RTM) is up to date with Passed/Failed status
- [ ] Documentation updated in `documentation/` for user-visible changes
- [ ] All conversation transcripts committed
- [ ] All milestone results archived to `results/MilestoneN/`

## Available Skills

| Skill | Command | Purpose |
|---|---|---|
| Diligent Developer | `/diligent-developer` | Full development workflow — specification, planning, implementation, testing, commits, PRs |
| Spec Builder | `/spec-builder` | Build specification documents with requirements, gap analysis, and success metrics |
| Skill Creator | `/skill-creator` | Create or update Claude Code skills |
| Project Commands | `/project-commands` | Canonical commands, build order, pitfalls, and troubleshooting |

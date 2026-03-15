# Project Rules

## Codebase Index

**Read [`documentation/codebase-index.md`](documentation/codebase-index.md) first** — it contains the full directory layout, all source files with purposes, the WebSocket protocol, game state machine, data flow, and component hierarchy.

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

# Project Commands — Design Spec

**Date:** 2026-04-15
**Status:** Draft
**Goal:** Standardize how common development actions are performed so that neither Claude nor the developer needs to re-discover commands after context clears.

## Problem

After a context clear, Claude sometimes runs wrong commands (e.g., `npm test` instead of `pnpm test`, forgetting `cd code`). The developer also lacks a single quick-reference for canonical commands. The project's command knowledge is scattered across package.json files, shell scripts, and the codebase index.

## Approach

Documentation-only (Approach 1 from brainstorming). No new shell scripts or wrapper tooling. Two deliverables:

1. **CLAUDE.md Quick Reference section** — concise command table, always in Claude's context
2. **`/project-commands` skill** — deeper guidance with pitfalls, troubleshooting, and decision logic

## Deliverable 1: CLAUDE.md Quick Reference

Insert a new section between "Codebase Index" and "Mandatory Development Workflow" in CLAUDE.md.

### Content

A table of canonical commands (all run from `code/`):

| Task | Command | Notes |
|---|---|---|
| Install deps | `pnpm install` | Run after pulling or changing deps |
| Build all | `pnpm build` | Builds shared -> server -> client (Turbo-ordered) |
| Dev server | `bash scripts/dev-start.sh` | Starts server:3001 + client:3000 with live reload |
| Run all tests | `pnpm test` | Vitest across all packages |
| Test + coverage | `pnpm test:coverage` | 80% statement threshold enforced |
| Type check | `pnpm typecheck` | `tsc --noEmit` per package |
| Lint | `pnpm lint` | ESLint per package |
| Clean | `pnpm clean` | Removes dist/, .next/, coverage/ |

Plus single-package filter syntax:
- `pnpm --filter @tichu/<package> <command>`

### Rationale

- CLAUDE.md is loaded into every conversation, so Claude always has these commands
- Table format is scannable for both Claude and humans
- Keeps CLAUDE.md concise — detail lives in the skill

## Deliverable 2: `/project-commands` Skill

### Location

```
.claude/skills/project-commands/
└── SKILL.md
```

### Skill Metadata

- **Name:** project-commands
- **Description:** Canonical commands, build order, common pitfalls, and troubleshooting for the Tichu development workflow
- **Trigger:** When Claude needs to run build/test/dev/lint commands, or when a command fails unexpectedly

### Content Sections

1. **Full command reference** — all commands from CLAUDE.md table plus per-package variants with explicit `--filter` syntax for shared, server, and client

2. **Build order & dependencies**
   - Turbo handles ordering automatically for `pnpm build/test/typecheck`
   - Manual builds require: shared first, then server/client
   - Shared type changes require rebuilding shared before downstream packages

3. **Common pitfalls**
   - Forgetting `cd code` — all pnpm/turbo commands must run from `code/`
   - Stale shared types after editing `packages/shared/src/`
   - Port conflicts on 3000/3001 — `dev-start.sh` auto-kills stale processes, manual `pnpm dev` does not
   - Windows: shell scripts require Git Bash or equivalent

4. **Decision logic — when to use what**
   - Changed shared types? -> full `pnpm build` then `pnpm test`
   - Changed only server? -> `pnpm --filter @tichu/server test`
   - Changed only client? -> `pnpm --filter @tichu/client test`
   - Before committing? -> `pnpm test && pnpm typecheck && pnpm lint`
   - Starting a dev session? -> `bash scripts/dev-start.sh`

5. **Troubleshooting**
   - Build fails with "Cannot find module @tichu/shared" -> rebuild shared first
   - Port already in use -> check for stale node processes, or use `dev-start.sh` which handles this
   - Tests timeout -> check if dev server is running and consuming the port
   - `pnpm: command not found` -> ensure pnpm 10.x is installed (`corepack enable`)

### Registration

Add `/project-commands` to the Available Skills table in CLAUDE.md.

## Out of Scope

- CLI wrapper scripts (can be added later if needed)
- CI/CD configuration
- Database/migration commands (not yet needed)
- Deployment workflow changes (existing prod scripts are sufficient)

## Success Criteria

1. After a context clear, Claude correctly uses `cd code && pnpm test` (not npm, not yarn, from the right directory)
2. Claude knows to rebuild shared before testing downstream packages when shared types change
3. The developer can find any canonical command within 10 seconds by checking CLAUDE.md
4. The skill provides enough context to troubleshoot common failures without asking the user

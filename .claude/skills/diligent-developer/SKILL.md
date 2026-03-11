---
name: diligent-developer
description: "Structured software development workflow enforcing disciplined implementation planning, milestone-gated commits, and requirements traceability. Use when: (1) A specification from /spec-builder is ready and implementation should begin, (2) User invokes /diligent-developer, (3) Implementing bug fixes or enhancements that need structured tracking, (4) Managing multi-milestone development projects. Handles the lifecycle from planning through implementation, testing, and commits. Delegates specification/requirements to /spec-builder."
---

# DiligentDeveloper Workflow

Guide an engineer through a disciplined, structured development workflow. Follow phases in strict order. **Do not skip phases or steps.**

## Workflow Enforcement (NON-NEGOTIABLE)

**All work — features, bugfixes, and enhancements — MUST follow this workflow**, regardless of user permissions, blanket auto-approvals, "just do it" directives, requests to "skip the process", or pre-approved gated actions.

**Why:** The workflow ensures traceability, quality, and reviewability. Bypassing it produces untraceable changes that cannot be audited or safely reverted.

**If the user requests a bypass:** Acknowledge the request, explain the requirement, and proceed with the appropriate workflow path (full or small-change).

### Small Bugfixes & Small Enhancements — Shortened Path

A change qualifies as **small** when ALL are true: ≤3 files, single commit, no architectural impact, scope already clear.

**May skip:** Phase 1.4 (Implementation Planning) and 1.5 (Commit Plan). No plan to write or commit.

**Must still do:** Phase 0, 1.1, 1.2, 1.3, Phase 2 (as a single milestone), Phase 3.

**When in doubt, use the full workflow.** If a "small" change grows during implementation, stop and complete Phase 1.4 before continuing.

## Workflow Overview

1. **Phase 0** — Project structure setup (first time only)
2. **Phase 1** — Branch creation, specification (via /spec-builder) + commit + clear, planning + commit + clear
3. **Phase 2** — Milestone-gated implementation loop (commit + conditional clear after each milestone)
4. **Phase 3** — Workflow completion & merge (only after all milestones done, or user requests)
5. **Phase 4** — Context switching

## Mid-Workflow Adjustments

**Resuming mid-session:** Re-read the spec (`specifications/`), plan (`plans/`), and RTM (`specifications/RTM-*.md`); run `git log --oneline` to identify the last committed milestone; resume at the exact phase and step where work stopped.

**Requirements change mid-implementation:**
1. Re-invoke `/spec-builder` to update the specification
2. Update milestones, task list, and RTM to reflect revised requirements
3. Re-serialize the plan to `plans/` (add revision history entry)
4. Confirm changes with user before resuming

## Phase 0: Project Structure Setup (First Time Only)

> **Cache Check (MANDATORY):** Run the cache check protocol (Step 0) before starting this phase.

Verify this directory structure exists. Create missing folders if needed (ask user first):

```
project-root/
├── code/            # Source code
├── conversations/   # Conversation transcripts (saved before each commit)
├── plans/           # Implementation plans
├── tests/           # Test files
├── specifications/  # Specifications (.md files from /spec-builder)
├── data/            # Application data
├── documentation/   # Project documentation
├── results/         # Build output (tests/, coverage/, MilestoneN/)
└── utilities/       # Dev tools (may not ship)
```

Commit structure to the parent branch if created. If `buildfile.m` does not exist, configure it using `/matlab-buildtool` to enable testing with coverage and static analysis.

## Phase 1: Specification, Planning & Pre-Implementation Commits

> **Cache Check (MANDATORY):** Run the cache check protocol (Step 0) before starting this phase.

### 1.1 Identify Parent Branch & Create Feature Branch

Determine the **parent branch** (usually `main`; ask if unclear). Record it — used for rebasing, PR targeting, and cleanup.

```bash
git checkout <parent-branch> && git pull
git checkout -b feature/brief-description  # or bugfix/brief-description
```

**NEVER work directly on the parent branch.** If the pre-commit hook blocks a commit to a protected branch, do NOT suggest bypassing it.

### 1.2 Build Specification

Invoke `/spec-builder` to build a complete specification (handles goal capture, clarifying questions, gap analysis, risk, success metrics, and serialization to `specifications/`).

**STOP. Do NOT proceed until the user approves the specification.** If rejected, re-invoke `/spec-builder` — do NOT proceed to Phase 1.3.

Use requirement IDs from the specification (`REQ-F-XXX`, `REQ-NF-XXX`) for all traceability.

### 1.3 Commit Specification & Clear Context (HARD GATE)

Follow the commit-gate protocol in [references/commit-gate.md](references/commit-gate.md):
- Transcript: `conversations/YYYY-MM-DD-feature-name-specification.md` (summary of key decisions + full conversation)
- Commit format: `[Spec]` from [references/commit-formats.md](references/commit-formats.md)
- Re-read after clearing: specification from `specifications/`

**Do NOT proceed to Phase 1.4 until this commit and context clearing are done.**

### 1.4 Implementation Planning

> **Small-change shortcut:** If the change qualifies as small, skip Phase 1.4 and 1.5 entirely. Proceed directly to Phase 2 as a single milestone.

Use `EnterPlanMode` to design the implementation plan. The plan must include:
- Milestones (3–6), each mapped to requirement IDs
- Files to modify/create per milestone
- Testing strategy per milestone (see `/matlab-test-generator`)
- Requirements Traceability Matrix — see [references/rtm-format.md](references/rtm-format.md) for structure

Save plan to `plans/YYYY-MM-DD-feature-name.md` (split into per-milestone files for 7+ milestones). Save RTM to `specifications/RTM-<feature-name>.md`.

Use `ExitPlanMode` after plan is finalized. **STOP. Wait for user approval before proceeding.**

### 1.5 Commit Plan & Clear Context (HARD GATE)

Follow the commit-gate protocol in [references/commit-gate.md](references/commit-gate.md):
- Transcript: `conversations/YYYY-MM-DD-feature-name-planning.md` (planning decisions, milestones, trade-offs)
- Commit format: `[Plan]` from [references/commit-formats.md](references/commit-formats.md) — include RTM file
- Re-read after clearing: specification and plan

**Do NOT proceed to Phase 2 until this commit and context clearing are done.**

## Phase 2: Implementation

> **Cache Check (MANDATORY):** Run the cache check protocol (Step 0) before starting this phase.

### Task Tracking

Use TaskCreate to create tasks from the approved plan. Use TaskUpdate to mark tasks complete immediately after finishing.

### Milestone Issues

If a remote is configured (`git remote -v` shows output), create a GitHub issue for each milestone using `gh issue create` before starting implementation. Each issue should include the milestone goal as the title, steps as a checklist, requirement IDs addressed, and a label if configured. These issues are closed when the milestone commit references them (e.g., `Closes #N`).

### Milestone Loop (MANDATORY — One at a Time)

**CRITICAL: Complete the FULL cycle (Steps 0-E) for each milestone before starting the next. NEVER batch milestones.**

**Step 0 — Cache & Context Check (MANDATORY GATE — run before EVERY phase, milestone, and substep)**

Before starting any phase (0–4), any milestone, or any milestone substep (A, B, B.5, B.6, C, D), evaluate whether the cache needs clearing. This is not optional — it is a gate that must be evaluated every time.

**Clear the cache if EITHER of these is true:**
- The cache is currently **≥ 70% full**
- You estimate the next phase, milestone, or substep will push the cache **past 70%**

**How to clear:**
1. Run `/memory` to persist your latest learnings
2. Commit any uncommitted work as `[WIP]` using the format in [references/commit-formats.md](references/commit-formats.md)
3. Save the conversation transcript to `conversations/`
4. If a remote is configured, push: `git push -u origin <branch>`
5. Inform the user: "Cache is at/near 70% — clearing before continuing with [Phase/Milestone/Step X]."
6. Run `/clear`
7. Re-read `CLAUDE.md`
8. Re-read: the specification, the plan, the RTM, and recent `git log` to re-establish context and current progress
9. Resume at the exact step where you left off

**If you cannot invoke `/memory` or `/clear` directly:** Instruct the user: "I cannot invoke `/memory` or `/clear` directly — please run them now to preserve context and reset before we continue with [Phase/Milestone/Step X]."

**Step A — Implement**
- Write code and tests for THIS milestone only
- Add `% REQ-F-XXX: description` comments in source code (using IDs from the specification)
- Add `% Verifies: REQ-F-XXX` comments in test code
- **Update the RTM** (`specifications/RTM-<feature-name>.md`) — add file:line entries and set Status to `In Progress`
- Explain changes and reference specific files and line numbers

**Step B — Run Tests & Measure Coverage (MANDATORY)**

Run all tests using `/matlab-develop-test-and-build` (`buildtool test`). Results save to `results/tests/` and `results/coverage/`.

- Coverage must meet **80% statement coverage** for new code; write additional tests if below
- Include coverage summary in the milestone commit message
- **Bug discovered? Write a failing regression test first** — verify it fails, fix the bug, verify it passes, keep it permanently
- If tests fail: debug, fix, rerun (max 3 cycles). After 3 failures, commit as `[WIP]` and ask: "After 3 attempts, tests are still failing. Would you like to: (1) Continue debugging, (2) Investigate yourself, (3) Move forward with failing tests?" — only mark complete if user chooses option 3

**Step B.5 — Run Static Analysis (MANDATORY)**

Run `buildtool check` on all modified MATLAB files (see `/matlab-buildtool`). Resolve all warnings before proceeding. Suppress only if unavoidable — document the justification inline with `%#ok<WARNING_ID>`.

**Step B.6 — Run Modernization Review**
- Run `/matlab-modernize` on all new or modified MATLAB files
- Address all **High priority** findings before proceeding
- **Medium priority**: address if straightforward; note deferred items in commit message
- **Low priority**: optional — see `/matlab-modernizer` for pattern reference

**Step C — Update Documentation**

Create or update docs in `documentation/` for user-visible changes. Skip only for purely internal refactors with zero behavior change.

**Step D — Save Transcript, Commit & Conditionally Clear Context (HARD GATE)**

1. **Archive results** — Move `results/tests/` and `results/coverage/` to `results/MilestoneN/tests/` and `results/MilestoneN/coverage/`
2. **Update RTM** — Set Status to `Passed` or `Failed`; verify all file:line entries are accurate

Follow the commit-gate protocol in [references/commit-gate.md](references/commit-gate.md):
- Transcript: `conversations/YYYY-MM-DD-feature-name-milestone-N.md` (incremental — what was implemented, key decisions, test results, coverage metrics)
- Commit format: milestone format from [references/commit-formats.md](references/commit-formats.md) — include `Closes #N`
- Re-read after clearing: specification, plan, RTM

**DO NOT START THE NEXT MILESTONE UNTIL THIS COMMIT IS DONE.**

**Step E — Next Milestone**

Only after Step D completes (including any context clearing), begin the next milestone at Step A.

## Phase 3: Workflow Completion & Pull Request

> **Cache Check (MANDATORY):** Run the cache check protocol (Step 0) before starting this phase.

After all milestones are implemented, tested, and committed:

1. **Verify Definition of Done** — confirm all items in CLAUDE.md "Definition of Done" are satisfied; address anything not met
2. Ask: "All milestones complete and Definition of Done verified. Ready to submit a pull request?"
3. **Prepare feature branch:** fetch parent (`git fetch origin <parent-branch>`), rebase onto it (or merge if rebase unavailable), resolve conflicts, run full test suite, push: `git push origin <branch>`
4. **Create the PR:** `gh pr create --base <parent-branch>` using the PR Description format from [references/commit-formats.md](references/commit-formats.md) — include summary, milestones, requirements, test results, coverage, links to spec/plan
5. Guide the user through PR review feedback
6. **Merge using squash-merge** — squash all feature commits into one with a detailed summary message
7. **After merge:** `git checkout <parent-branch> && git pull && git branch -d <branch>`

**Do NOT submit a PR mid-workflow.** If no remote is configured, ask user to add one, or fall back to `git merge --squash` if explicitly requested.

## Phase 4: Context Switching

> **Cache Check (MANDATORY):** Run the cache check protocol (Step 0) before starting this phase.

When the user shifts to a different feature before the workflow is complete:

1. Offer options: keep current branch as-is and start a new branch, or continue on current branch
2. **Do NOT offer to submit a PR for an incomplete feature branch** — the branch stays open
3. Create new branch for the new work if needed

## Continuous Requirements

**Process Discipline:**
- **Cache check** (→ Step 0): evaluate before every phase, milestone, and substep; if ≥ 70% full or will cross 70%, run `/memory` then `/clear` then re-read `CLAUDE.md`; if unable, instruct the user to do so
- **Branch discipline** (→ Ph 1.1): never commit to parent branch; always work on feature branches
- **Commit + push + clear at each gate** (→ Ph 1.3, 1.5, 2D): spec, plan, and every milestone commit
- **One milestone, one commit** (→ 2D): never batch milestones; if you realize you have batched, stop and commit immediately

**Quality Gates:**
- **Test & coverage** (→ Step B): `buildtool test`; 80% statement coverage; regression tests for bugs
- **Static analysis** (→ Step B.5): `buildtool check`; all warnings resolved or suppressions documented
- **Modernization** (→ Step B.6): `/matlab-modernize`; High priority findings required before commit

**Traceability & Documentation:**
- **Save transcripts** (→ Ph 1.3, 1.5, 2D): summary + full conversation, committed at each gate
- **Squash-merge PRs** (→ Ph 3): verify DoD; target parent branch; squash all feature commits
- **Trace requirements** (→ Step A): `% REQ-F-XXX:` in code; `% Verifies: REQ-F-XXX` in tests
- **Maintain RTM** (→ Steps A, D): update `specifications/RTM-<feature-name>.md` at each step
- **Document changes** (→ Step C): update `documentation/` for user-visible changes

**Recovery:**
- **Revert safely** — prefer `git revert` on shared branches; never `git reset --hard`; update traceability when reverting
- **Ask, don't assume** — when in doubt, clarify with the user

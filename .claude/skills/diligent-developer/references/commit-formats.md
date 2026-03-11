# Commit Formats

## Specification Commit

```
[Spec]: Brief description of specification

Changes made:
- Created/updated specification: specifications/YYYY-MM-DD-spec-title.md
- Saved conversation transcript: conversations/YYYY-MM-DD-feature-name-specification.md

Requirements defined:
- REQ-F-XXX: Brief description
- REQ-F-YYY: Brief description
- REQ-NF-XXX: Brief description

Explanation:
Summary of what the specification covers — goal, scope, key requirements,
and confidence level. Reference the spec file for full details.

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

## Plan Commit

```
[Plan]: Brief description of implementation plan

Changes made:
- Created/updated plan: plans/YYYY-MM-DD-feature-name.md
- Created/updated RTM: specifications/RTM-<feature-name>.md
- Saved conversation transcript: conversations/YYYY-MM-DD-feature-name-planning.md

Milestones planned:
- Milestone 1: Brief description (REQ-F-XXX, REQ-F-YYY)
- Milestone 2: Brief description (REQ-F-ZZZ)
- Milestone 3: Brief description (REQ-NF-XXX)

Explanation:
Summary of the implementation approach — number of milestones,
key architectural decisions, and testing strategy.

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

## Milestone Commit (Tests Passing)

```
[Goal]: Brief description of milestone

Changes made:
- Specific change 1
- Specific change 2
- Specific change 3
- Updated RTM: specifications/RTM-<feature-name>.md
- Saved conversation transcript: conversations/YYYY-MM-DD-feature-name-milestone-N.md

Requirements addressed:
- REQ-F-XXX: Brief description (Passed)
- REQ-F-YYY: Brief description (Passed)

Explanation:
Why these changes were necessary and how they accomplish the goal.

Tests: All passing (X run, X passed)
Coverage: XX% statement coverage (Y/Z statements)
Static analysis: Clean (N files checked)

Closes #N

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

Replace `<model>` with the actual model name and version (e.g., `Opus 4.6`, `Sonnet 4.5`).

## WIP Commit (Tests Failing After 3 Attempts)

```
[WIP]: Brief description (TESTS FAILING)

Changes made:
- Specific change 1
- Specific change 2
- Saved conversation transcript: conversations/YYYY-MM-DD-feature-name-milestone-N.md

Requirements addressed:
- REQ-F-XXX: Brief description

Explanation:
Why these changes were necessary.

Tests: FAILING - X run, Y failed, Z passed
Failed tests: [list specific failing tests]

Note: Work-in-progress after 3 debug attempts.
Tests must be fixed before milestone completion.

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

## Pull Request Description (Phase 3)

When merging a PR, **always squash-merge** — squash all feature branch commits into a single commit on main. Use `gh pr merge --squash` or configure GitHub to squash-merge. The squash commit message should summarize all squashed commits.

Use this template for the `--body` argument when creating a PR with `gh pr create`:

```markdown
## Summary
High-level description of the feature goal and what was achieved.

## Milestones completed
- Milestone 1: Brief description (REQ-F-XXX, REQ-F-YYY)
- Milestone 2: Brief description (REQ-F-ZZZ)
- Milestone 3: Brief description (REQ-NF-XXX)

## Requirements addressed
- REQ-F-XXX: Brief description
- REQ-F-YYY: Brief description
- REQ-NF-XXX: Brief description

## Test results
All passing (X run, X passed)
Coverage: XX% statement coverage
Static analysis: Clean

## References
- Specification: specifications/YYYY-MM-DD-spec-title.md
- Plan: plans/YYYY-MM-DD-feature-name.md
- Traceability: specifications/RTM-<feature-name>.md
```

## Project Structure Commit (Phase 0)

```
[Setup]: Created DiligentDeveloper project structure

Changes made:
- Created standard directory structure for organized development

Explanation:
Establishes consistent project organization with separate folders for
code, plans, tests, requirements, data, documentation, results, and utilities.

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

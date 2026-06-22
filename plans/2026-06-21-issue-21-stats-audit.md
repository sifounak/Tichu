# Issue #21 Plan: Stats Audit and Definition Pass

## Summary

Create a formal audit package for GitHub issue #21, "Some stats are missing or incorrect," before implementing code fixes.

The first deliverable is documentation, not behavior changes:

- A formal stats audit specification.
- A requirements traceability matrix (RTM).
- A discrepancy list with recommended follow-up implementation choices.

The audit must cover every visible stats surface:

- `/stats`
- `/stats/cards`
- `/stats/tichu`
- `/stats/players`
- `/leaderboard`
- `/profile`

## Goals

- Define every visible stat in user-facing terms.
- Map each stat to its API field, cache/database column, and raw event source.
- Classify current behavior as correct, incorrect, ambiguous, approximate, or unsupported.
- Identify the minimum regression tests needed for each stat.
- Preserve open implementation decisions until after the audit is reviewed.

## Scope Decisions

- Full audit scope: all stats surfaces, not only the dedicated Play Stats pages.
- Blind Grand Tichu is a separate category from Grand Tichu.
- Bot filtering is out of scope for #21 and belongs to #24.
- Round-by-round persistence is out of scope for #21 and belongs to #25.
- Current completed-game stats capture remains the source of truth for this audit.
- Stats that are approximate or weakly defined should be recommended for precise implementation or removal/hiding.
- Do not decide schema/API rename/add/remove choices until after the audit findings are written.

## Known Findings to Seed the Audit

- Phoenix usage and Phoenix straight detection likely fail on real data because `stats-cache.ts` checks uppercase strings such as `Single` and `Straight`, while real event capture stores lowercase `CombinationType` enum values such as `single` and `straight`.
- "Longest straight" should be audited as any straight, not only the current Phoenix-specific `longestStraightWithPhoenix` display.
- "The Tichu" 13-card straight detection likely has the same combination enum casing risk.
- Captured-with-bomb and Blind Grand have existing narrow tests, but still need to be audited across capture, cache, API serialization, and UI display.
- Bomb pass stats include comments describing simplified or approximate behavior and need exact definitions or removal recommendations.

## Audit Spec Requirements

Create a formal specification under `specifications/` using the repository's existing spec style.

For each visible stat, record:

- User-facing label.
- Surface(s) where it appears.
- Intended definition.
- Source level: game, round, trick, play, pass, bomb inventory, relational aggregate, or derived display value.
- Inclusion/exclusion rules.
- API field.
- cache/database column.
- Raw event table(s) or event capture source.
- Current status.
- Recommended action.

Important definition defaults:

- `gamesPlayed`: count games where the user has at least one `player_rounds` row.
- `gamesWon`: current final-occupant semantics remain under audit; do not change until reviewed.
- Blind Grand calls/successes do not increment Grand Tichu calls/successes.
- Longest straight means the longest straight played by the user, with or without Phoenix. Whether to add a new field, rename an existing field, or remove the current Phoenix-only display is intentionally deferred.

## RTM Requirements

Create a matching RTM under `specifications/`.

The RTM should map each audited stat to:

- Requirement ID.
- UI surface.
- API/profile field.
- cache/database field.
- raw event source.
- status.
- recommended implementation/test follow-up.

Suggested statuses:

- `Defined`
- `Correct`
- `Incorrect`
- `Ambiguous`
- `Approximate`
- `Unsupported`
- `Remove or Hide`
- `Needs Implementation Decision`

## Test Planning Requirements

Do not implement tests during the audit-only phase unless explicitly requested after the audit.

For each stat, record the minimum future test level:

- Cache-level raw event fixture for computation.
- API query assertion for serialization.
- UI/component assertion when labels, formatting, or derived display values are part of the behavior.

Required future regression scenarios for issue #21 examples:

- Phoenix used as single, pair, triple, full house, pair sequence, and straight.
- Longest straight with Phoenix.
- Longest straight without Phoenix.
- 13-card "The Tichu" straight, clean and dirty.
- Dragon captured by a bomb.
- Blind Grand calls and successes separate from Grand Tichu.

Also include future regression coverage for:

- Relationship stats in `/stats/players`.
- Leaderboard rates.
- `/profile` summary stats.
- Any stat recommended for removal/hiding because it cannot be computed precisely from existing raw data.

## Verification During Audit

Run the existing baseline stats cache tests before and after creating the audit docs:

```bash
pnpm --filter @tichu/server test -- tests/db/stats-cache.test.ts
```

If docs-only changes do not require full test execution, record that no behavior changed and that the baseline stats cache test was the relevant verification.

## Expected Output

At the end of the audit phase, the repo should contain:

- A new specification file for issue #21's stats audit.
- A new RTM file for issue #21's stats audit.
- No production behavior changes unless the user explicitly asks to continue into implementation.

The final response should summarize:

- The files created.
- The biggest confirmed discrepancies.
- The implementation decisions that remain open.
- The recommended next implementation batch.

## Fresh Context Implementation Prompt

After clearing the context window, ask:

```text
Implement the audit/spec/RTM phase from plans/2026-06-21-issue-21-stats-audit.md. Do not fix production code yet. Create the formal issue #21 stats audit specification and RTM, covering every stats surface listed in the plan. Run the relevant baseline stats cache test, then summarize the confirmed discrepancies and the implementation decisions that remain open.
```

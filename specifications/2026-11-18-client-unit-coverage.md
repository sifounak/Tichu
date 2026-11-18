# Client unit coverage specification

Approved plan: improve Vitest/React Testing Library coverage without browser automation.

| Requirement | Acceptance |
|---|---|
| REQ-F-UC01 | Shared realistic state, identity, timer and network fixtures; reproducible lint tooling; CI uses Node 24 and pinned pnpm. |
| REQ-F-UC02 | Authentication, guard, navigation and rejoin behavior tested; failed regressions precede fixes. |
| REQ-F-UC03 | Game actions, room settings/permissions, votes, kick/leave/reconnect, spectators and pre-game passing tested. |
| REQ-F-UC04 | Feedback, keyboard navigation, scaling and effect cleanup tested in jsdom; page composition uses mocked network/navigation. |
| REQ-NF-UC01 | At least 80% client statements overall; authStore, AuthGuard, useNavigationBlock, ActionBar, PreRoomView, VoteOverlay, KickDialog, LeaveConfirmDialog, WaitingForReconnectOverlay each at least 90% statements/80% branches. |
| REQ-NF-UC02 | Tests, typecheck, lint and production compilation pass; CI enforces coverage and uploads reports; docs/traceability/results retained. |

Preserve product rules and hidden guest access. Fix discovered defects within covered flows. Keep route components, declarations and pure barrels outside the unit denominator, with accurate documentation. No browser tests, downloads, Playwright dependency or browser CI jobs. Existing manual utilities are outside this work.

Risk: comprehensive component states require deterministic fixtures and cleanup; simulate browser event contracts rather than claim real-browser compatibility. Coverage is paired with assertions; thresholds must not be weakened or exclusions widened. Parent work: completed play-stats-participation branch.

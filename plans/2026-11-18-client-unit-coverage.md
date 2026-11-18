# Client unit coverage implementation plan

Base: bugfix/play-stats-participation (completed stats work). Branch: test/client-unit-coverage.

1. UC01 infrastructure: tests/fixtures identity/game/store/network helpers; declare ESLint 9 + typescript-eslint 8, modern client lint command, Node 24/pinned pnpm CI. Verify existing suite and lint/typecheck; commit milestone.
2. UC02 authentication/navigation: store race/storage/session regressions, AuthGuard, navigation hook, active banner. Fake timers/network and Next router mocks. Critical 90% statement/80% branch checks on these modules; commit.
3. UC03 game/room: add state-driven tests for dialogs, actions, menu/drawer, settings, PreRoomView and pre-game interactions; fix proven regressions. Meet remaining critical module thresholds; commit.
4. UC04/NF: feedback/keyboard/scale/effect tests and remaining meaningful coverage scenarios, overall 80% and named critical gates, CI uploads/required job docs, production build/typecheck/lint and all suites. Commit final results.

Use pnpm/Vitest/TypeScript equivalents for repository MATLAB-only workflow commands. User approval already covers specification and plan. Automatic compaction is used in place of unavailable /clear; checkpoints here preserve progress. No external publishing or production data changes are part of implementation.

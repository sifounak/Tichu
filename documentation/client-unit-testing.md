# Client unit testing

The client uses Vitest, React Testing Library, jsdom and V8 coverage. This effort adds component/hook coverage without browser automation or browser downloads.

Commands run from `code/`: `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm typecheck`. A targeted client suite uses `pnpm --filter @tichu/client test -- tests/<path>`.

Shared test fixtures in `packages/client/tests/fixtures/client.ts` provide isolated store resets, realistic player/game data and controllable JSON/deferred responses. Tests clean up mounted components, timers, mocks and storage. Fake timers are used for timing contracts; network and Next navigation are controlled at the boundary.

Lint uses the shared `eslint.config.mjs` and declared ESLint/TypeScript/React-hooks plugins. TypeScript checks names; ESLint's core no-undef rule is disabled for TypeScript sources. Client lint uses `eslint src/`, replacing the removed Next.js lint command. CI uses Node 24 and the repository's pinned pnpm 11.9.0.

Coverage requires 80% overall client statements. Nine critical authentication/navigation/control modules additionally require 90% statements and 80% branches. Route components have focused mocked component tests and remain outside the unit percentage, alongside declarations and pure barrel exports. Real-browser layout/history integration remains outside this effort.

Authentication tests exercise real store/guard composition, persisted profiles, credential rejection, retries and asynchronous races. New authentication intent invalidates prior responses; logging out stops a pending login or background verification from restoring the account. Logout also settles loading. Existing guest access remains hidden.

Navigation tests simulate the Navigation API, popstate and persisted pageshow contracts in jsdom, including delayed arming, confirm/cancel and listener teardown. Active-game banner tests check identity/header selection, refresh, hidden routes and rejoin actions.

Game/room tests cover actual menus, drawers, role restrictions, settings updates, seat claims, votes, Tichu/passing controls, pending play and cancellation. Seat offers now decline once at expiry and stop their timers. Mobile pre-room renders its own chrome only, preventing duplicated leave dialogs. Leave confirmation exposes dialog semantics, supports Escape, contains Tab focus and restores the opener on cancellation.

## Coverage and CI

CI runs build, lint, typecheck and `pnpm test:coverage`, and uploads all package coverage reports for 14 days. GitHub main now requires the existing `build-and-test` check, including administrators. No additional pull-request review requirement was added. The client uses two Vitest workers, and the coverage command runs package jobs sequentially to avoid resource contention; test timeouts and coverage thresholds remain strict.

Final validation: 488 client, 1,094 server and 440 shared tests pass (2,022 total). Client coverage increased from 70.59% to 93.76% statements. The complete coverage command took approximately 92 seconds on the development workstation with unchanged server/shared results eligible for cache reuse. This is not a guaranteed cold CI runtime.

| Critical module | Statements | Branches |
|---|---:|---:|
| authStore | 100% | 87.32% |
| AuthGuard | 100% | 100% |
| useNavigationBlock | 97.40% | 96.67% |
| ActionBar | 98.10% | 94.59% |
| PreRoomView | 98.04% | 87.88% |
| VoteOverlay | 100% | 93.48% |
| KickDialog | 100% | 100% |
| LeaveConfirmDialog | 100% | 100% |
| WaitingForReconnectOverlay | 100% | 100% |

Connection/status feedback, spinner visibility, toast deadlines, roving card focus, scaling boundaries, resize/observer teardown, and room metadata cleanup are tested with controlled events and timers. No browser automation libraries or downloads were added.

On this Windows workstation, production packaging is verified with the existing junction preload in `results/play-stats-participation/Milestone3/verify-junctions.mjs`, avoiding unavailable directory symlink privileges. CI's Linux build uses the normal command. Existing lint warnings in the game/lobby route files are outside the new critical modules; lint passes with no errors.

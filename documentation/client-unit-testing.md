# Client unit testing

The client uses Vitest, React Testing Library, jsdom and V8 coverage. This effort adds component/hook coverage without browser automation or browser downloads.

Commands run from `code/`: `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm typecheck`. A targeted client suite uses `pnpm --filter @tichu/client test -- tests/<path>`.

Shared test fixtures in `packages/client/tests/fixtures/client.ts` provide isolated store resets, realistic player/game data and controllable JSON/deferred responses. Tests clean up mounted components, timers, mocks and storage. Fake timers are used for timing contracts; network and Next navigation are controlled at the boundary.

Lint uses the shared `eslint.config.mjs` and declared ESLint/TypeScript/React-hooks plugins. TypeScript checks names; ESLint's core no-undef rule is disabled for TypeScript sources. Client lint uses `eslint src/`, replacing the removed Next.js lint command. CI uses Node 24 and the repository's pinned pnpm 11.9.0.

Coverage gates and additional behavior scenarios are introduced in the subsequent milestones. Route components are measured separately through focused component tests; they remain outside the unit percentage. Real-browser layout/history integration remains outside this effort.

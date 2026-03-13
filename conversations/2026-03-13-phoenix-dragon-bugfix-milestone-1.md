# Conversation: Phoenix-Dragon Bugfix — Milestone 1 (Implementation)

**Date**: 2026-03-13
**Phase**: Implementation (Phase 2)

## Summary

### Changes Made
1. **phoenix-resolver.ts**: Added Dragon guard in `resolveSinglePhoenix` — returns `{ status: 'invalid' }` when `topRank >= DRAGON_RANK` (25). Added `DRAGON_RANK` import from constants.
2. **phoenix-resolver.test.ts**: Added 4 new tests — Phoenix on Dragon (invalid), Phoenix on King (13.5), and two 4-of-kind+Phoenix regression tests ([3,3,3,3,Phoenix] and [7,7,7,7,Phoenix]).
3. **combination-detector.test.ts**: Added 2 new regression tests for [3,3,3,3,Phoenix] and [7,7,7,7,Phoenix] returning null.

### Test Results
- Shared: 380 tests passing (was 375, +5 new)
- Server: 354 tests passing (no change)
- Total: 734 tests, 0 failures

### Key Decisions
- Fix was a missing `DRAGON_RANK` import + 3-line guard clause
- Client auto-fixed: `useCardSelection.ts:82` already checks `phoenixResolution.status === 'invalid'`
- No server changes needed (server already correctly rejects)

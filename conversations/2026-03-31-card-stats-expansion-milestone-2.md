# Card / Hand Stats Expansion — Milestone 2

**Date:** 2026-03-31
**Milestone:** M2: Detection Logic in RoundEventTracker
**Requirements:** REQ-F-CS03, CS06, CS07, CS10, CS13, CS16, CS19, CS20

## What Was Implemented

6 detection changes in round-event-tracker.ts:

1. **detectPhoenixPlay()** — NEW: classifies Phoenix plays by CombinationType (Single/Pair/Triple/FullHouse/PairSequence/Straight), tracks longestStraightWithPhoenix via Math.max
2. **detectDogPlay()** — MODIFIED: added dog control classification (partner/opponent/self) using getPartner()
3. **detectDogStuck()** — NEW: detects hand.length === 1 && isDog, uses Set<Seat> to count once per round
4. **detectBombPlays()** — MODIFIED: replaced 3-bucket system with per-size counters (bombSize4–bombSize14), split over-bomb into youOverBombed (attacker) and youWereOverBombed (victim)
5. **detectConflictingBombs()** — NEW: runs after card exchange, finds 4-of-a-kind + straight flush rank conflicts
6. **capturePassData()** — MODIFIED: extended with gave direction (dragon/phoenix/ace/mahjong), dog received from partner/opponent, bomb completion detection

## Test Results

23/23 round-event-tracker tests pass (10 new tests added):
- Phoenix play type detection (single, pair, straight)
- Dog control classification (partner, opponent, self)
- Dog stuck as last card (detection + once-per-round guard)
- Per-size bomb tracking (4-card, 5-card straight flush)
- Conflicting bombs (conflict detected + no-conflict case)
- Extended pass tracking (gave direction, mahjong received)
- Bomb completion in pass

Pre-existing failures in other test files (24 failures in auth-routes, bot-integration, game-manager, move-handler, round-ending-edge-cases, room-handler) are not related to these changes.

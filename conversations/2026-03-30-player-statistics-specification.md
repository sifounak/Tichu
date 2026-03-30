# Player Statistics System — Specification Conversation

## Summary

### Goal
Implement comprehensive player statistics tracking (~35 stats) with persistence, event capture, and UI display.

### Key Decisions
- **Bot stats:** Humans only — bots have no user accounts
- **Forfeit definition:** Player disconnects and never reconnects before game end (bot replacement still counts as forfeit)
- **Spectated definition:** Any time a player enters spectator mode in a room
- **Database approach:** Wide `playerStats` table with ~50 columns for O(1) reads
- **Event capture:** State-diff observer in `GameManager.onStateChange()` — no XState modification
- **Hand-diff for pass tracking:** Since `passedCards.received` is boolean only, diff pre/post-pass hands
- **Stats page:** New `/stats` page accessible from lobby top-right button (not reusing `/profile`)

### Stat Categories
1. **Group A (Game-level, 6 stats):** Games played/won/forfeited/spectated, largest win/loss diff, 1-2 finishes
2. **Group B (Round-level, 10 stats):** Rounds played/won, Tichu/GT calls+success, opponent/partner Tichu broken
3. **Group C (Card events, 17 stats):** Dragon/Phoenix/Dog/Ace tracking, bomb stats, over-bombed, wish-forced, "The Tichu"
4. **Group D (Relational, 2 types):** Per-partner and per-opponent win rates

### Requirements Defined
- 29 functional requirements (REQ-F-PW01 through REQ-F-UI06)
- 4 non-functional requirements (REQ-NF-P01 through REQ-NF-P04)
- Confidence: High

### Architecture
- New `RoundEventTracker` class for mid-round event detection
- `wireGameEndCallback` in GameManager for persistence wiring
- 3 DB changes: extend playerStats (~35 cols), new playerRelationalStats table, new roundPlayerEvents table
- 3 API endpoints: extended profile, partners, opponents
- New `/stats` page with 4 tabs + stats button in lobby

### Risks
- State-diff observer missing events (mitigated by comprehensive tests)
- Schema migration breaking existing DB (mitigated by DEFAULT 0 on all new columns)
- `passedCards.received` being boolean-only (mitigated by hand-diff approach)

## Conversation

User requested tracking ~35 player statistics including game-level, round-level, card events (Dragon/Phoenix/Dog/Ace/Bombs), and relational stats (per-partner, per-opponent). They asked about database storage, implementation approach, and UI display.

Exploration phase discovered:
- SQLite migration from PostgreSQL is complete
- `saveGameResult()` exists but is never called
- Profile and leaderboard pages exist with basic stats UI
- `passedCards.received` is boolean, not card list — need hand-diff approach
- State machine uses pure `assign` actions — need observer pattern for event capture

Plan was written and approved. Specification built via /spec-builder with 29 functional + 4 non-functional requirements.

User requested adding a stats button to the lobby page (top-right corner) navigating to a dedicated `/stats` page. This was added as REQ-F-UI01 (stats button) and REQ-F-UI02 (dedicated stats page), renumbering subsequent UI requirements.

Clarifying questions answered:
- Bot stats: humans only
- Forfeit: disconnect + never return
- Spectated: any spectator mode entry

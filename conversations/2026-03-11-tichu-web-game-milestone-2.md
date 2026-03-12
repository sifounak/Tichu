# Milestone 2: Shared Types + Deck — Conversation Transcript

**Date:** 2026-03-11
**Branch:** feature/tichu-web-game
**Milestone:** M2 — Shared Types + Deck

## Summary

Implemented the core TypeScript type system and deck engine for the Tichu game. This milestone establishes the type foundation that all subsequent milestones depend on.

### Key Decisions

1. **Discriminated union pattern**: Used `kind` as the discriminant property for all card types (StandardCard, DragonCard, PhoenixCard, MahjongCard, DogCard). This enables exhaustive switch statements and type narrowing.

2. **Card ID scheme**: Standard cards use IDs 0–51 (4 suits × 13 ranks), special cards use IDs 52–55 (Mahjong, Dog, Phoenix, Dragon). Deterministic assignment by suit then rank.

3. **GameCard wrapper**: All cards are wrapped in `GameCard = { id: CardId, card: Card }` to pair the unique ID with the card data.

4. **Zod schemas for protocol**: Created comprehensive Zod schemas for all client→server and server→client WebSocket messages. The GAME_STATE message uses `z.any()` for the state payload since `ClientGameView` is validated separately.

5. **Coverage strategy**: Excluded `src/index.ts` and `src/types/index.ts` (barrel re-exports) from coverage since they contain no logic. `room.ts` is pure interfaces with no runtime statements.

6. **REQ-F-C04 implemented early**: Card point values were originally planned for M6 but make sense as part of the constants alongside deck creation.

### Files Created

- `code/packages/shared/src/types/card.ts` — Card types, enums, type guards
- `code/packages/shared/src/types/combination.ts` — CombinationType enum, Combination interface
- `code/packages/shared/src/types/game.ts` — GamePhase, Seat, Team, PlayerState, RoundState, GameState, ClientGameView
- `code/packages/shared/src/types/protocol.ts` — Zod schemas for all WebSocket messages
- `code/packages/shared/src/types/room.ts` — Room, RoomConfig, LobbyEntry types
- `code/packages/shared/src/types/index.ts` — Barrel re-export
- `code/packages/shared/src/constants.ts` — Card points, deck constants, rank ordering
- `code/packages/shared/src/engine/deck.ts` — createDeck(), shuffleDeck(), dealCards()

### Test Results

- **113 tests passing** across 7 test files
- **100% statement coverage** on all source files with runtime code
- Build compiles cleanly with no TypeScript errors

### Requirements Addressed

- REQ-F-C01: 56-card deck with unique IDs ✅
- REQ-F-C02: Fisher-Yates shuffle ✅
- REQ-F-C03: Deal 8+6 cards per player ✅
- REQ-F-C04: Card point values ✅

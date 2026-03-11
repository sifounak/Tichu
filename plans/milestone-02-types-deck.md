# Milestone 2: Shared Types + Deck

**Package(s):** shared
**Requirements:** Foundation types for all game logic

## Goal

Define all core TypeScript types and implement deck creation, shuffling, and dealing. This is the type foundation that every other milestone depends on.

## Tasks

### 2.1 Card types (`packages/shared/src/types/card.ts`)
- `Suit` enum: Jade, Pagoda, Star, Sword
- `SpecialCardType` enum: Dragon, Phoenix, Mahjong, Dog
- `StandardCard`, `DragonCard`, `PhoenixCard`, `MahjongCard`, `DogCard` discriminated unions
- `Card` union type
- `CardId` type (0-55)
- `GameCard` = `{ id: CardId; card: Card }`
- Card utility functions: `isSpecial()`, `isStandard()`, `getCardRank()`, `getCardSuit()`

### 2.2 Combination types (`packages/shared/src/types/combination.ts`)
- `CombinationType` enum: Single, Pair, Triple, FullHouse, Straight, PairSequence, FourBomb, StraightFlushBomb
- `Combination` type: `{ type, cards, rank, length, phoenixUsedAs?, isBomb }`

### 2.3 Game state types (`packages/shared/src/types/game.ts`)
- `Seat` type: 'north' | 'east' | 'south' | 'west'
- `Team` type: 'northSouth' | 'eastWest'
- `GamePhase` enum (all FSM states)
- `PlayerState`, `TrickState`, `RoundState`, `GameState`, `GameConfig`
- `ClientGameView` (projected state for each player)

### 2.4 Protocol types (`packages/shared/src/types/protocol.ts`)
- `ClientMessage` discriminated union (all client→server messages)
- `ServerMessage` discriminated union (all server→client messages)
- Zod schemas for validation

### 2.5 Room types (`packages/shared/src/types/room.ts`)
- `Room`, `RoomConfig`, `LobbyEntry`

### 2.6 Deck engine (`packages/shared/src/engine/deck.ts`)
- `createDeck(): GameCard[]` — all 56 cards with unique IDs
- `shuffleDeck(deck: GameCard[]): GameCard[]` — Fisher-Yates shuffle
- `dealCards(deck: GameCard[]): Record<Seat, { first8: GameCard[], remaining6: GameCard[] }>`

### 2.7 Constants (`packages/shared/src/constants.ts`)
- Card point values (Kings=10, Tens=10, Fives=5, Dragon=25, Phoenix=-25)
- Rank ordering, special card properties

## Tests

- Card creation: all 56 cards, unique IDs, correct suit/rank
- Deck shuffle: same cards, different order, all 56 present
- Deal: each player gets 8+6=14 cards, no duplicates across players
- Type guards: `isSpecial()`, `isStandard()` correctness
- Zod schema validation: valid/invalid messages

## Verification

1. `pnpm turbo test --filter=@tichu/shared` — all tests pass
2. 100% statement coverage on new files
3. `pnpm turbo build --filter=@tichu/shared` — compiles cleanly

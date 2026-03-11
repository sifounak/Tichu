# Milestone 6: Scoring + Rules

**Package(s):** shared
**Requirements:** Round/game scoring, Mahjong wish logic, top-level rule orchestration

## Goal

Implement scoring (card points, Tichu/Grand Tichu bonuses, 1-2 finish), Mahjong wish tracking, and the top-level rules module that ties all engine components together.

## Tasks

### 6.1 Scoring (`packages/shared/src/engine/scoring.ts`)

- `getCardPoints(card: Card): number` — Kings=10, Tens=10, Fives=5, Dragon=25, Phoenix=-25, all others=0
- `getTrickPoints(trick: TrickState): number` — sum of card points in trick
- `scoreRound(finishOrder: Seat[], trickPoints: Record<Seat, number>, tichuCalls: Record<Seat, 'none'|'tichu'|'grandTichu'>): Record<Team, number>`
  - Standard scoring: count card points per team
  - 1-2 finish bonus: if both partners go out first and second, their team gets all 100 points (opponents get 0 card points)
  - Last player's remaining hand points go to opponents; last player's tricks go to the first-out player
  - Tichu bonus/penalty: +100/-100
  - Grand Tichu bonus/penalty: +200/-200
- `checkGameOver(scores: Record<Team, number>, targetScore: number): Team | null`

### 6.2 Wish logic (`packages/shared/src/engine/wish.ts`)

- `canFulfillWish(hand: GameCard[], wish: number, currentTrick: Combination | null): boolean`
  - Check if the player has the wished rank AND can play it in a valid combination that beats the current trick
- `mustFulfillWish(hand: GameCard[], wish: number, currentTrick: Combination | null): boolean`
  - Returns true if the player CAN fulfill the wish (meaning they MUST)
- `isWishFulfilled(play: Combination, wish: number): boolean`
  - Check if a play contains the wished rank

### 6.3 Rules orchestration (`packages/shared/src/engine/rules.ts`)

- `validatePlay(cards: GameCard[], hand: GameCard[], currentTrick: TrickState | null, wish: number | null): PlayValidation`
  - Combines combination detection, Phoenix resolution, combination validation, wish checking
  - Returns `{ valid: true, combination } | { valid: false, reason: string }`
- `getValidPlays(hand: GameCard[], currentTrick: TrickState | null, wish: number | null): Combination[]`
  - All valid plays from a hand (used by bots and for validation)
- `canPlayerPass(hand: GameCard[], currentTrick: TrickState | null, wish: number | null): boolean`
  - Can't pass if you can fulfill the wish
  - Can't pass if leading (must play)

## Tests

### Scoring tests
- Card points: each special card, standard cards
- Simple round: no Tichu, distributed finish
- 1-2 finish: team bonus (200 points for winning team, 0 for losers)
- Tichu success: +100 bonus
- Tichu failure: -100 penalty
- Grand Tichu success/failure: +200/-200
- Last player: hand points to opponents, tricks to first-out
- Game over check: exactly at target, over target, neither team at target

### Wish tests
- Player has wished rank and can beat trick → must fulfill
- Player has wished rank but can't beat trick → can pass
- Player doesn't have wished rank → can pass
- Wish fulfilled by a play containing the rank
- Phoenix cannot fulfill wish (Phoenix can represent wished rank in a combination, but the real card must be played if available)

### Rules integration tests
- Full play validation chain: valid play, invalid combination, can't beat trick, wish violation
- `getValidPlays` returns correct set for various hand/trick combinations
- Pass logic: can't pass when leading, can't pass when wish fulfillable

## Verification

1. All tests pass with 100% coverage
2. Build succeeds
3. Integration: rules.ts correctly chains detector → Phoenix resolver → validator → wish checker

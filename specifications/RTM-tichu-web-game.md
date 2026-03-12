# Requirements Traceability Matrix — Tichu Web Game

**Specification:** `specifications/2026-03-10-spec-tichu-web-game.md`
**Plan:** `plans/2026-03-10-tichu-web-game.md`

## Summary Table

| Requirement ID | Description | Milestone | Status |
|---|---|---|---|
| REQ-F-C01 | 56-card deck with unique IDs | M2 | Passed |
| REQ-F-C02 | Fisher-Yates shuffle | M2 | Passed |
| REQ-F-C03 | Deal 8+6 cards per player | M2 | Passed |
| REQ-F-C04 | Card point values | M2, M6 | Passed |
| REQ-F-CB01 | Detect all combination types | M3 | Passed |
| REQ-F-CB02 | Combination comparison/ranking | M3 | Passed |
| REQ-F-CB03 | Dragon only as single | M3 | Passed |
| REQ-F-CB04 | Dog only as lead | M3 | Passed |
| REQ-F-CB05 | Mahjong rank 1 in straights | M3 | Passed |
| REQ-F-CB06 | Enumerate all valid plays | M3 | Passed |
| REQ-F-PH01 | Phoenix never forms bomb | M4 | Passed |
| REQ-F-PH02 | Phoenix never acts as special cards | M4 | Passed |
| REQ-F-PH03 | Phoenix value >= 2 in combinations | M4 | Passed |
| REQ-F-PH04 | Leading single Phoenix = 1.5 | M4 | Passed |
| REQ-F-PH05 | Phoenix on trick = leader + 0.5 | M4 | Passed |
| REQ-F-PH06 | Auto-determine Phoenix when unambiguous | M4 | Passed |
| REQ-F-PH07 | Present only valid Phoenix options | M4 | Passed |
| REQ-F-PH08 | Phoenix in straight starting with 2 | M4 | Passed |
| REQ-F-GF01 | Game lifecycle state machine | M7 | Passed |
| REQ-F-GF02 | Card passing (1 to each other player) | M7 | Passed |
| REQ-F-GF03 | Mahjong leads first trick + wish | M6, M7 | Passed |
| REQ-F-GF04 | Wish enforcement | M6 | Passed |
| REQ-F-GF05 | Trick won by 3 consecutive passes | M7 | Passed |
| REQ-F-GF06 | Round ends when ≤1 player has cards | M7 | Passed |
| REQ-F-GF07 | Turn order skips finished players | M7 | Passed |
| REQ-F-GF08 | Tichu declaration +100/-100 | M6, M7 | Passed |
| REQ-F-GF09 | Grand Tichu +200/-200 | M6, M7 | Passed |
| REQ-F-GF10 | Customizable target score | M6 | Passed |
| REQ-F-DR01 | Dragon trick given to opponent | M7, M9 | Passed |
| REQ-F-DR02 | Dragon auto-select when 1 opponent left | M9 | Passed |
| REQ-F-DR03 | Bomb overrides Dragon gift | M9 | Passed |
| REQ-F-SC01 | Standard round scoring | M6 | Passed |
| REQ-F-SC02 | 1-2 finish bonus | M6 | Passed |
| REQ-F-SC03 | Last player redistribution | M6 | Passed |
| REQ-F-HV01 | Progressive card filtering | M5 | Passed |
| REQ-F-HV02 | Dragon/Dog disables all others | M5 | Passed |
| REQ-F-HV03 | Dog disabled when trick active | M5 | Passed |
| REQ-F-HV04 | Phoenix disabled if would form bomb | M5 | Passed |
| REQ-F-HV05 | Prefix matching for partial selections | M5 | Passed |
| REQ-F-HV06 | Prevent invalid plays via UI | M12 | Passed |
| REQ-F-HV07 | Click-to-select interaction | M12 | Passed |
| REQ-F-HV08 | Drag-and-drop via @dnd-kit | M12 | Deferred |
| REQ-F-HV09 | Greyed-out card styling | M12 | Passed |
| REQ-F-MP01 | Any combination 0-4 humans + bots | M9, M10 | Passed |
| REQ-F-MP02 | Room codes for matchmaking | M13 | Passed |
| REQ-F-MP03 | Public lobby | M13 | Passed |
| REQ-F-MP04 | Room configuration options | M13 | Passed |
| REQ-F-MP05 | Fixed seat partnerships | M13 | Passed |
| REQ-F-MP06 | Spectator mode | M15 | Passed |
| REQ-F-MP07 | In-game text chat | M15 | Passed |
| REQ-F-MP08 | Disconnect handling with vote | M9, M15 | Passed |
| REQ-F-MP09 | Optional turn timer | M7, M15 | Passed |
| REQ-F-BOT01 | Bot strategy interface | M10 | Passed |
| REQ-F-BOT02 | EasyBot implementation | M10 | Passed |
| REQ-F-BOT03 | MediumBot heuristics | M10 | Not Started |
| REQ-F-BOT04 | HardBot (future) | — | Not Started |
| REQ-F-BOT05 | Artificial thinking delay | M10 | Passed |
| REQ-F-AU01 | Guest access | M14 | Passed |
| REQ-F-AU02 | Optional account registration | M14 | Passed |
| REQ-F-AU03 | Game history persistence | M14 | Passed |
| REQ-F-AU04 | Leaderboard | M14 | Passed |
| REQ-F-DI01 | Cards remaining per player | M11, M12 | Passed |
| REQ-F-DI02 | Current trick leader + current player | M12 | Passed |
| REQ-F-DI03 | Pass indicators | M12 | Passed |
| REQ-F-DI04 | Tichu/Grand Tichu call indicators | M12 | Passed |
| REQ-F-DI05 | Score with expandable history | M12 | Passed |
| REQ-F-DI06 | Current trick in center | M12 | Passed |
| REQ-F-DI07 | Mahjong wish indicator | M12 | Passed |
| REQ-NF-P01 | Hand filter < 1ms | M5 | Passed |
| REQ-NF-P02 | 60fps animations | M15 | Passed |
| REQ-NF-P03 | WebSocket latency < 100ms local | M8 | Passed |
| REQ-NF-U01 | Responsive desktop + mobile | M11, M15 | Passed |
| REQ-NF-U02 | Configurable animation speed + prefers-reduced-motion | M15 | Passed |
| REQ-NF-U03 | Keyboard navigation | M15 | Passed |
| REQ-NF-U04 | Screen reader support | M15 | Passed |
| REQ-NF-U05 | WCAG AA color contrast | M15 | Passed |
| REQ-NF-U06 | 44×44px touch targets | M15 | Passed |
| REQ-NF-A01 | Shared game logic monorepo package | M1 | Passed |
| REQ-NF-A02 | Server authoritative, projected state | M8 | Passed |
| REQ-NF-A03 | Zod validation on WebSocket messages | M8 | Passed |
| REQ-NF-A04 | i18n-ready with next-intl | M11 | Not Started |
| REQ-NF-D01 | Docker Compose single-command startup | M1 | Passed |
| REQ-NF-D02 | Cloud-deployable architecture | M1 | Passed |
| REQ-NF-T01 | 80%+ coverage for new code | All | Passed |
| REQ-NF-T02 | 100% coverage for shared engine | M2-M6 | Passed |

## Detailed Entries

> **REQ-NF-A01** — Shared game logic monorepo package — *Passed*
> - Code:
>   - `code/pnpm-workspace.yaml` (workspace config)
>   - `code/packages/shared/package.json` (@tichu/shared package)
>   - `code/packages/shared/src/index.ts` (barrel export)
> - Tests:
>   - `code/packages/shared/tests/smoke.test.ts`

> **REQ-NF-D01** — Docker Compose single-command startup — *Passed*
> - Code:
>   - `code/docker-compose.yml` (client + server + db services)
>   - `code/packages/server/Dockerfile`
>   - `code/packages/client/Dockerfile`

> **REQ-NF-D02** — Cloud-deployable architecture — *Passed*
> - Code:
>   - `code/docker-compose.yml` (container-based, maps to orchestration)
>   - `code/packages/server/Dockerfile` (multi-stage build)
>   - `code/packages/client/Dockerfile` (multi-stage build)

> **REQ-F-C01** — 56-card deck with unique IDs — *Passed*
> - Code:
>   - `code/packages/shared/src/types/card.ts:1-101` (Card types, Suit/Rank enums, discriminated unions)
>   - `code/packages/shared/src/engine/deck.ts:13-40` (`createDeck()` — 52 standard + 4 special)
> - Tests:
>   - `code/packages/shared/tests/types/card.test.ts` (type guards, enums)
>   - `code/packages/shared/tests/engine/deck.test.ts` (56 cards, unique IDs, suit/rank combos, specials)

> **REQ-F-C02** — Fisher-Yates shuffle — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/deck.ts:42-52` (`shuffleDeck()` — Durstenfeld variant)
> - Tests:
>   - `code/packages/shared/tests/engine/deck.test.ts` (same cards, different order, no mutation)

> **REQ-F-C03** — Deal 8+6 cards per player — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/deck.ts:55-78` (`dealCards()` — first 8 + remaining 6)
> - Tests:
>   - `code/packages/shared/tests/engine/deck.test.ts` (8+6 per player, no duplicates, wrong deck size throws)

> **REQ-F-C04** — Card point values — *Passed*
> - Code:
>   - `code/packages/shared/src/constants.ts:6-18` (`getCardPoints()` — Kings=10, Tens=10, Fives=5, Dragon=25, Phoenix=-25)
> - Tests:
>   - `code/packages/shared/tests/constants.test.ts` (all card types, total deck = 100)

> **REQ-F-CB01** — Detect all combination types — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/combination-detector.ts:18-45` (`detectCombination()` — routes to type-specific detectors)
>   - `code/packages/shared/src/engine/combination-detector.ts:49-95` (Single detection — standard, Dragon, Phoenix, Mahjong, Dog)
>   - `code/packages/shared/src/engine/combination-detector.ts:99-136` (Pair detection — standard + Phoenix wild)
>   - `code/packages/shared/src/engine/combination-detector.ts:140-173` (Triple detection — standard + Phoenix wild)
>   - `code/packages/shared/src/engine/combination-detector.ts:177-271` (Full House detection — 3+2, Phoenix completing pair/triple, 2+2+Phoenix)
>   - `code/packages/shared/src/engine/combination-detector.ts:286-385` (Straight detection — 5+ consecutive, Mahjong rank 1, Phoenix gap-fill/extend)
>   - `code/packages/shared/src/engine/combination-detector.ts:389-438` (Pair Sequence detection — 2+ consecutive pairs, Phoenix)
>   - `code/packages/shared/src/engine/combination-detector.ts:442-479` (Bomb detection — Four-of-a-kind and Straight Flush)
> - Tests:
>   - `code/packages/shared/tests/engine/combination-detector.test.ts` (56 tests — all types, Phoenix, specials, edge cases)

> **REQ-F-CB02** — Combination comparison/ranking — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/combination-validator.ts:14-46` (`canBeat()` — same type+length+higher rank, bombs beat all)
>   - `code/packages/shared/src/engine/combination-validator.ts:54-80` (`compareBombs()` — SF > 4-bomb, length then rank)
>   - `code/packages/shared/src/engine/combination-validator.ts:88-100` (`getRankOrder()` — numeric ordering for comparison)
> - Tests:
>   - `code/packages/shared/tests/engine/combination-validator.test.ts` (29 tests — same type, cross type, bombs, Dog)

> **REQ-F-CB03** — Dragon only as single — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/combination-detector.ts:63-70` (Dragon detected as Single with rank 25)
>   - `code/packages/shared/src/engine/combination-detector.ts` (Dragon rejected in pairs, triples, full houses, straights)
> - Tests:
>   - `code/packages/shared/tests/engine/combination-detector.test.ts` (Dragon single, rejected in multi-card)

> **REQ-F-CB04** — Dog only as lead — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/combination-detector.ts:55-61` (Dog detected as Single with rank 0)
>   - `code/packages/shared/src/engine/combination-validator.ts:32` (Dog rank 0 cannot beat anything)
>   - `code/packages/shared/src/engine/combination-utils.ts:34` (Dog filtered out when trick is active)
> - Tests:
>   - `code/packages/shared/tests/engine/combination-detector.test.ts` (Dog single rank 0)
>   - `code/packages/shared/tests/engine/combination-validator.test.ts` (Dog can't beat, can lead)
>   - `code/packages/shared/tests/engine/combination-utils.test.ts` (Dog filtered from following plays)

> **REQ-F-CB05** — Mahjong rank 1 in straights — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/combination-detector.ts:278-283` (`getStraightRank()` — Mahjong returns 1)
> - Tests:
>   - `code/packages/shared/tests/engine/combination-detector.test.ts` (Mahjong-started straights)

> **REQ-F-CB06** — Enumerate all valid plays — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/combination-utils.ts:14-46` (`getAllValidPlays()` — generates candidates, filters by canBeat)
>   - `code/packages/shared/src/engine/combination-utils.ts:56-441` (Candidate generation — singles, pairs, triples, bombs, full houses, straights, pair sequences, straight flush bombs)
> - Tests:
>   - `code/packages/shared/tests/engine/combination-utils.test.ts` (17 tests — leading, following, Dog filter, bombs, Phoenix pairs, straights, full houses, pair sequences, straight flush bombs)

> **REQ-F-PH01** — Phoenix never forms bomb — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:167-180` (three-of-a-kind + Phoenix → invalid)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:262-269` (same-suit straight + Phoenix → SF bomb → invalid)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (four-bomb, straight flush bomb tests)

> **REQ-F-PH02** — Phoenix never acts as special cards — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:45-48` (Dragon/Dog + Phoenix → invalid)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:109-110` (pair with Mahjong → invalid)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (Phoenix + Dragon, Dog, Mahjong → invalid)

> **REQ-F-PH03** — Phoenix value >= 2 in combinations — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:296-299` (gap fill: value >= 2 check)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:311` (extend low: lowExtend >= 2 check)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (Mahjong straight, starting-with-2 straight)

> **REQ-F-PH04** — Leading single Phoenix = 1.5 — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:97-99` (single_lead with PHOENIX_SINGLE_VALUE)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (single lead, empty trick)

> **REQ-F-PH05** — Phoenix on trick = leader + 0.5 — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:101-104` (single_ontrick with topRank + 0.5)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (trick with 7 → 7.5, trick with Ace → 14.5)

> **REQ-F-PH06** — Auto-determine Phoenix when unambiguous — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:108-111` (pair auto)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:115-121` (triple auto)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:128-157` (full house auto/choose)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:287-322` (straight auto/choose)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (pair, triple, full house 3+1, gap straight, pair sequence)

> **REQ-F-PH07** — Present only valid Phoenix options — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:155-157` (full house 2+2 → choose both ranks)
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:324-325` (straight open-ended → choose)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (2+2 full house choose, open-ended straight choose)

> **REQ-F-PH08** — Phoenix in straight starting with 2 — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/phoenix-resolver.ts:311` (lowExtend >= 2 prevents going below)
> - Tests:
>   - `code/packages/shared/tests/engine/phoenix-resolver.test.ts` ([2,3,4,5,Phoenix] → auto 6)

> **REQ-F-HV01** — Progressive card filtering — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/hand-filter.ts:22-60` (`getSelectableCards()` — main entry point)
>   - `code/packages/shared/src/engine/hand-filter.ts:65-106` (`getInitialSelectableCards()` — Phase 1 empty selection)
> - Tests:
>   - `code/packages/shared/tests/engine/hand-filter.test.ts` (47 tests — all phases, constraints, wish, performance)

> **REQ-F-HV02** — Dragon/Dog disables all others — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/hand-filter.ts:38-40` (Dragon/Dog selected → return empty set)
>   - `code/packages/shared/src/engine/hand-filter.ts:51-53` (Dragon/Dog cannot be added to multi-card)
> - Tests:
>   - `code/packages/shared/tests/engine/hand-filter.test.ts` (Dragon selected, Dog selected → empty)

> **REQ-F-HV03** — Dog disabled when trick active — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/hand-filter.ts:85-88` (Dog filtered when trick has plays)
> - Tests:
>   - `code/packages/shared/tests/engine/hand-filter.test.ts` (Dog disabled on trick, enabled when leading)

> **REQ-F-HV04** — Phoenix disabled if would form bomb — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/hand-filter.ts:45-47` (wouldFormBomb check before adding Phoenix)
>   - `code/packages/shared/src/engine/hand-filter.ts:297-331` (`wouldFormBomb()` — four-bomb and SF bomb patterns)
> - Tests:
>   - `code/packages/shared/tests/engine/hand-filter.test.ts` (3 Kings + Phoenix, 4 consecutive same suit + Phoenix)

> **REQ-F-HV05** — Prefix matching for partial selections — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/hand-filter.ts:112-184` (`canFormValidPrefix()` — same rank, straight, pair seq, full house, bomb prefixes)
> - Tests:
>   - `code/packages/shared/tests/engine/hand-filter.test.ts` (prefix tests — same rank, consecutive, pair seq, full house, bomb, trick constraints)

> **REQ-F-SC01** — Standard round scoring — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/scoring.ts:17-30` (`getCardsPoints()`, `getTrickPoints()` — card point summation)
>   - `code/packages/shared/src/engine/scoring.ts:46-111` (`scoreRound()` — full round scoring with redistribution)
> - Tests:
>   - `code/packages/shared/tests/engine/scoring.test.ts` (34 tests — card points, trick points, round scoring)

> **REQ-F-SC02** — 1-2 finish bonus — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/scoring.ts:65-69` (1-2 finish detection: both partners 1st+2nd → 200 pts)
> - Tests:
>   - `code/packages/shared/tests/engine/scoring.test.ts` (NS 1-2 finish, EW 1-2 finish, no bonus when 1st+3rd)

> **REQ-F-SC03** — Last player redistribution — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/scoring.ts:72-96` (last player tricks → first-out; hand points → opponents)
> - Tests:
>   - `code/packages/shared/tests/engine/scoring.test.ts` (tricks to first-out, hand to opponents, Dragon/Phoenix in hand)

> **REQ-F-GF04** — Wish enforcement — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/wish.ts:14-17` (`isWishFulfilled()` — checks real card, not Phoenix)
>   - `code/packages/shared/src/engine/wish.ts:26-46` (`canFulfillWish()` — has rank + valid play exists)
>   - `code/packages/shared/src/engine/wish.ts:53-58` (`mustFulfillWish()` — can = must)
>   - `code/packages/shared/src/engine/rules.ts:63-68` (wish check in validatePlay chain)
>   - `code/packages/shared/src/engine/rules.ts:86-92` (wish filtering in getValidPlays)
>   - `code/packages/shared/src/engine/rules.ts:107-109` (can't pass when wish fulfillable)
> - Tests:
>   - `code/packages/shared/tests/engine/wish.test.ts` (16 tests — fulfillment, can/must, Phoenix exclusion)
>   - `code/packages/shared/tests/engine/rules.test.ts` (wish enforcement in validate, getValidPlays, canPass)

> **REQ-F-GF08** — Tichu declaration +100/-100 — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/scoring.ts:99-107` (Tichu bonus/penalty in scoreRound)
> - Tests:
>   - `code/packages/shared/tests/engine/scoring.test.ts` (Tichu success +100, failure -100, multiple calls)

> **REQ-F-GF09** — Grand Tichu +200/-200 — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/scoring.ts:99-107` (Grand Tichu bonus/penalty in scoreRound)
> - Tests:
>   - `code/packages/shared/tests/engine/scoring.test.ts` (Grand Tichu success +200, failure -200)

> **REQ-F-GF10** — Customizable target score — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/scoring.ts:118-132` (`checkGameOver()` — configurable target, tie handling)
> - Tests:
>   - `code/packages/shared/tests/engine/scoring.test.ts` (not reached, exact, exceeded, both teams, tied, custom)

> **REQ-F-GF01** — Game lifecycle state machine — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:1-884` (XState v5 hierarchical FSM: lobby → grandTichuDecision → regularTichuDecision → cardPassing → playing → roundScoring → gameOver)
>   - `code/packages/server/src/game/game-state-machine.ts:82-89` (`createInitialContext()`)
>   - `code/packages/server/src/game/game-state-machine.ts:635-758` (state machine definition with all states and transitions)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (43 tests — lobby, tichu decisions, card passing, playing, trick completion, round lifecycle, multiple rounds)

> **REQ-F-GF02** — Card passing (1 to each other player) — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:397-410` (`recordCardPass` — records cards to pass)
>   - `code/packages/server/src/game/game-state-machine.ts:413-456` (`executeCardExchange` — removes passed cards, adds received cards)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (card passing tests: records, prevents duplicates, exchanges correctly, 14 cards after exchange)

> **REQ-F-GF03** — Mahjong leads first trick + wish — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:122-130` (`findMahjongHolder()`)
>   - `code/packages/server/src/game/game-state-machine.ts:458-464` (`enterPlaying` — sets Mahjong holder as first turn)
>   - `code/packages/server/src/game/game-state-machine.ts:487-492` (wish handling in playCards)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (Mahjong holder leads first trick, findMahjongHolder unit test)

> **REQ-F-GF05** — Trick won by 3 consecutive passes — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:145-157` (`isTrickComplete()` — 3 passes or all active non-winners passed)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (trick completion: 0 passes, 3 passes, active non-winners passed, empty trick)

> **REQ-F-GF06** — Round ends when ≤1 player has cards — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:138-141` (`countActivePlayers()`)
>   - `code/packages/server/src/game/game-state-machine.ts:804-806` (round completion check in completeTrickAndAdvance)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (countActivePlayers: 4→3→2→1, full round lifecycle)

> **REQ-F-GF07** — Turn order skips finished players — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:133-139` (`getNextActiveSeat()` — skips players with finishOrder set)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (skips finished south, wraps around correctly)

> **REQ-F-GF08** — Tichu declaration +100/-100 — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:362-372` (`recordRegularTichuCall` — in pre-play phases)
>   - `code/packages/server/src/game/game-state-machine.ts:716-728` (Tichu call during playing phase, before first play)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (Regular Tichu call, doesn't override Grand Tichu, call during playing phase)

> **REQ-F-GF09** — Grand Tichu +200/-200 — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:330-339` (`recordGrandTichuCall`)
>   - `code/packages/server/src/game/game-state-machine.ts:671-690` (grandTichuDecision state)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (Grand Tichu call, pass, prevents double decision)

> **REQ-F-DR01** — Dragon trick given to opponent — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:188-206` (`needsDragonGift()` — Dragon wins trick, not by bomb)
>   - `code/packages/server/src/game/game-state-machine.ts:209-213` (`getAutoGiftRecipient()` — auto-gift when 1 opponent remaining)
>   - `code/packages/server/src/game/game-state-machine.ts:612-631` (`giveDragonTrick` action)
>   - `code/packages/server/src/game/game-state-machine.ts:740-745` (awaitingDragonGift state)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (Dragon gift state exists, full round lifecycle includes awaitingDragonGift)

> **REQ-F-MP09** — Optional turn timer — *Passed*
> - Code:
>   - `code/packages/server/src/game/turn-timer.ts:1-82` (`TurnTimer` class: start, stop, remaining, dispose)
>   - `code/packages/server/src/game/game-state-machine.ts:584-609` (`handleTimeout` action — auto-pass on timeout)
> - Tests:
>   - `code/packages/server/tests/game/turn-timer.test.ts` (10 tests — timeout fires, stop prevents fire, restart, disabled, remaining time, dispose)
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (timeout auto-pass, wrong player timeout ignored)

> **REQ-NF-A02** — Server authoritative, projected state — *Passed*
> - Code:
>   - `code/packages/server/src/ws/connection-manager.ts:1-178` (`ConnectionManager` — client tracking, heartbeat, reconnection)
>   - `code/packages/server/src/ws/state-projection.ts:1-104` (`projectGameState()` — transforms full state to per-player `ClientGameView`)
>   - `code/packages/server/src/ws/broadcaster.ts:1-90` (`Broadcaster` — send to room/player/spectators with projected views)
>   - `code/packages/server/src/app.ts:1-143` (`createApp()` — Fastify + WebSocket server setup, upgrade handler, CORS)
> - Tests:
>   - `code/packages/server/tests/ws/connection-manager.test.ts` (16 tests — lifecycle, rooms, heartbeat, reconnection, dispose)
>   - `code/packages/server/tests/ws/state-projection.test.ts` (15 tests — hand visibility, phase mapping, trick state, indicators)
>   - `code/packages/server/tests/ws/broadcaster.test.ts` (10 tests — send, broadcastToRoom, projected game state, spectators, errors)

> **REQ-NF-A03** — Zod validation on WebSocket messages — *Passed*
> - Code:
>   - `code/packages/server/src/ws/message-router.ts:1-79` (`MessageRouter` — JSON parse, Zod validate, route to handler, error handling)
>   - `code/packages/shared/src/types/protocol.ts:1-104` (`clientMessageSchema` — Zod schemas for all client messages)
> - Tests:
>   - `code/packages/server/tests/ws/message-router.test.ts` (11 tests — JSON parse errors, Zod validation, auth check, handler routing, error handling)

> **REQ-NF-P03** — WebSocket latency < 100ms local — *Passed*
> - Code:
>   - `code/packages/server/src/ws/connection-manager.ts` (heartbeat/ping-pong for connection health)
>   - `code/packages/server/src/app.ts` (WebSocket upgrade on /ws path, direct message routing)
> - Tests:
>   - Integration latency measured during manual testing (M15)

> **REQ-F-DR01** — Dragon trick given to opponent — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:188-215` (needsDragonGift, getAutoGiftRecipient)
>   - `code/packages/server/src/game/game-state-machine.ts:612-631` (giveDragonTrick action)
>   - `code/packages/server/src/game/move-handler.ts:216-242` (handleGiftDragon — validates gift recipient)
>   - `code/packages/server/src/game/game-manager.ts:121-123` (routes GIFT_DRAGON message)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (Dragon gift state, auto-gift)
>   - `code/packages/server/tests/game/move-handler.test.ts` (reject invalid gift targets)

> **REQ-F-DR02** — Dragon auto-select when 1 opponent left — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:209-215` (getAutoGiftRecipient — returns sole opponent)
>   - `code/packages/server/src/game/game-state-machine.ts:786-796` (auto-gift in completeTrickAndAdvance)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (auto-gift when 1 opponent remaining)

> **REQ-F-DR03** — Bomb overrides Dragon gift — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-state-machine.ts:196-203` (needsDragonGift checks bomb override)
> - Tests:
>   - `code/packages/server/tests/game/game-state-machine.test.ts` (bomb wins trick containing Dragon)

> **REQ-F-MP01** — Any combination 0-4 humans + bots — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-manager.ts:1-168` (GameManager — orchestrates game per room)
>   - `code/packages/server/src/game/game-store.ts:1-103` (GameStore — manages active games)
>   - `code/packages/server/src/game/move-handler.ts:1-256` (MoveHandler — validates and routes moves)
> - Tests:
>   - `code/packages/server/tests/game/game-manager.test.ts` (21 tests — construction, seating, message routing, lifecycle)
>   - `code/packages/server/tests/game/game-store.test.ts` (16 tests — CRUD, concurrent games, isolation)
>   - `code/packages/server/tests/game/move-handler.test.ts` (30 tests — all message types, validation)

> **REQ-F-MP08** — Disconnect handling with vote — *Passed*
> - Code:
>   - `code/packages/server/src/game/disconnect-handler.ts:1-160` (DisconnectHandler — vote sessions, timeout, reconnect)
>   - `code/packages/server/src/game/game-manager.ts:152-161` (handleDisconnect, handleReconnect)
> - Tests:
>   - `code/packages/server/tests/game/disconnect-handler.test.ts` (17 tests — disconnect, reconnect, vote majority, timeout, cleanup)
>   - `code/packages/server/tests/game/game-manager.test.ts` (disconnect/reconnect delegation tests)

> **REQ-NF-P01** — Hand filter < 1ms — *Passed*
> - Code:
>   - `code/packages/shared/src/engine/hand-filter.ts` (all filtering logic)
> - Tests:
>   - `code/packages/shared/tests/engine/hand-filter.test.ts` (Performance test: 300 calls averaged < 1ms each)

> **REQ-F-BOT01** — Bot strategy interface — *Passed*
> - Code:
>   - `code/packages/server/src/bot/bot-interface.ts:1-68` (BotStrategy interface, BotPlayContext, BotPlayDecision types)
>   - `code/packages/server/src/bot/bot-runner.ts:1-237` (BotRunner — manages bot instances, schedules actions with delay, routes to strategy methods per game phase)
> - Tests:
>   - `code/packages/server/tests/bot/bot-runner.test.ts` (14 tests — bot management, phase handling, delay, dispose, custom strategy)

> **REQ-F-BOT02** — EasyBot implementation — *Passed*
> - Code:
>   - `code/packages/server/src/bot/easy-bot.ts:1-76` (EasyBot — random valid moves: always pass Tichu, random card passing, random valid play or pass, random Dragon gift, no wish)
> - Tests:
>   - `code/packages/server/tests/bot/easy-bot.test.ts` (16 tests — difficulty, Grand/Regular Tichu always pass, card passing, play selection, Phoenix handling, Dragon gift, no wish)
>   - `code/packages/server/tests/bot/bot-runner.test.ts` (full 4-bot game smoke test — runs to completion without errors)

> **REQ-F-BOT05** — Artificial thinking delay — *Passed*
> - Code:
>   - `code/packages/server/src/bot/bot-runner.ts:109-126` (scheduleAction — configurable min/max delay, instant mode for testing)
> - Tests:
>   - `code/packages/server/tests/bot/bot-runner.test.ts` (delay tests — default config delays, instant config immediate, dispose cancels timers)

> **REQ-F-MP01** — Any combination 0-4 humans + bots — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-manager.ts:1-203` (GameManager — orchestrates game per room)
>   - `code/packages/server/src/bot/bot-runner.ts:1-237` (BotRunner — manages bot instances, acts on behalf of bots)
>   - `code/packages/server/src/bot/easy-bot.ts:1-76` (EasyBot strategy)
> - Tests:
>   - `code/packages/server/tests/bot/bot-runner.test.ts` (full 4-bot game smoke test, mixed human/bot tests)

> **REQ-F-DI01** — Cards remaining per player — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/PlayerSeat.tsx:1-82` (PlayerSeat — shows card count per seat)
>   - `code/packages/client/src/components/game/GameTable.tsx:1-114` (GameTable — renders 4 seats with card counts)
>   - `code/packages/client/src/stores/gameStore.ts` (gameStore — maintains otherPlayers cardCount from server)
> - Tests:
>   - `code/packages/client/tests/components/game/PlayerSeat.test.tsx` (9 tests — name, card count, badges, pass, finish)
>   - `code/packages/client/tests/components/game/GameTable.test.tsx` (6 tests — all seats rendered, scores, phase)

> **REQ-NF-U01** — Responsive desktop + mobile — *Passed*
> - Code:
>   - `code/packages/client/src/app/globals.css` (design tokens with responsive card dimensions)
>   - `code/packages/client/src/components/game/GameTable.module.css` (CSS Grid with 640px mobile breakpoint)
>   - `code/packages/client/src/components/cards/CardHand.module.css` (card overlap desktop vs mobile)
> - Tests:
>   - `code/packages/client/tests/components/game/GameTable.test.tsx` (layout renders at any seat position)

> **REQ-NF-A03** — Zod validation on WebSocket messages — *Passed (client-side)*
> - Code:
>   - `code/packages/client/src/hooks/useWebSocket.ts:1-123` (useWebSocket — parses incoming messages via serverMessageSchema.safeParse)
> - Tests:
>   - `code/packages/client/tests/hooks/useWebSocket.test.ts` (11 tests — valid message parsing, invalid rejection, non-JSON rejection)

> **REQ-NF-U04** — Screen reader support — *Passed*
> - Code:
>   - `code/packages/client/src/components/cards/card-utils.ts` (cardAriaLabel — accessible label for every card)
>   - `code/packages/client/src/components/cards/Card.tsx` (aria-label, aria-pressed on card buttons)
>   - `code/packages/client/src/components/game/GameTable.tsx` (aria-label on game table, aria-live on phase indicator)
>   - `code/packages/client/src/components/game/TrickArea.tsx` (aria-label on trick area and wish indicator)
> - Tests:
>   - `code/packages/client/tests/components/cards/card-utils.test.ts` (aria label tests for all card types)
>   - `code/packages/client/tests/components/cards/Card.test.tsx` (aria-label rendering for all 56 cards)

> **REQ-F-HV06** — Prevent invalid plays via UI — *Passed*
> - Code:
>   - `code/packages/client/src/hooks/useCardSelection.ts:1-112` (useCardSelection — progressive filtering, canPlay, disabled computation)
>   - `code/packages/client/src/components/game/ActionBar.tsx:1-59` (Play button disabled when !canPlay)
> - Tests:
>   - `code/packages/client/tests/hooks/useCardSelection.test.ts` (12 tests — canPlay, disabled, selectability)
>   - `code/packages/client/tests/components/game/ActionBar.test.tsx` (13 tests — button enabled/disabled states)

> **REQ-F-HV07** — Click-to-select interaction — *Passed*
> - Code:
>   - `code/packages/client/src/hooks/useCardSelection.ts:93-105` (toggleCard — respects selectability)
>   - `code/packages/client/src/components/cards/CardHand.tsx` (onClick handler per card)
> - Tests:
>   - `code/packages/client/tests/hooks/useCardSelection.test.ts` (toggleCard tests — blocked when disabled, allowed when selectable)

> **REQ-F-HV09** — Greyed-out card styling — *Passed*
> - Code:
>   - `code/packages/client/src/hooks/useCardSelection.ts:64-72` (disabledIds computation)
>   - `code/packages/client/src/components/cards/Card.tsx:63-73` (disabled CSS class with 0.4 opacity)
> - Tests:
>   - `code/packages/client/tests/hooks/useCardSelection.test.ts` (disabled card computation, Dog disabled on trick)

> **REQ-F-DI01** — Cards remaining per player — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/PlayerSeat.tsx` (cardCount display)
>   - `code/packages/client/src/components/game/ScorePanel.tsx` (score panel with team info)
> - Tests:
>   - `code/packages/client/tests/components/game/PlayerSeat.test.tsx` (card count)
>   - `code/packages/client/tests/components/game/ScorePanel.test.tsx` (score display)

> **REQ-F-DI02** — Current trick leader + current player — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/TrickDisplay.tsx:1-85` (winner highlight, per-seat positioning)
>   - `code/packages/client/src/components/game/PlayerSeat.tsx:78-79` (turn indicator)
> - Tests:
>   - `code/packages/client/tests/components/game/TrickDisplay.test.tsx` (winner class, seat positions)

> **REQ-F-DI03** — Pass indicators — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/TrickDisplay.tsx:68-78` (pass labels in trick area)
>   - `code/packages/client/src/components/game/PlayerSeat.tsx:71-76` (pass badge on seat)
> - Tests:
>   - `code/packages/client/tests/components/game/TrickDisplay.test.tsx` (pass indicators)

> **REQ-F-DI04** — Tichu/Grand Tichu call indicators — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/ScorePanel.tsx:57-68` (tichu badges in score panel)
>   - `code/packages/client/src/components/game/ActionBar.tsx:45-57` (tichu call button)
> - Tests:
>   - `code/packages/client/tests/components/game/ScorePanel.test.tsx` (tichu badges)
>   - `code/packages/client/tests/components/game/ActionBar.test.tsx` (tichu button visibility)

> **REQ-F-DI05** — Score with expandable history — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/ScorePanel.tsx:1-85` (current scores, target, collapsible history)
> - Tests:
>   - `code/packages/client/tests/components/game/ScorePanel.test.tsx` (8 tests — scores, history toggle, expand)

> **REQ-F-DI06** — Current trick in center — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/TrickDisplay.tsx:1-85` (center trick display with cards from each seat)
> - Tests:
>   - `code/packages/client/tests/components/game/TrickDisplay.test.tsx` (9 tests — empty, plays, passes, multiple plays)

> **REQ-F-DI07** — Mahjong wish indicator — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/TrickDisplay.tsx:47-51` (wish indicator with rank label)
> - Tests:
>   - `code/packages/client/tests/components/game/TrickDisplay.test.tsx` (wish active, wish fulfilled hides)

> **REQ-F-MP02** — Room codes for matchmaking — *Passed*
> - Code:
>   - `code/packages/server/src/room/room-manager.ts:1-268` (RoomManager — create/join/leave rooms, 6-char code generation, user↔room↔seat tracking)
>   - `code/packages/server/src/room/room-handler.ts:1-239` (RoomHandler — WebSocket message routing for CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM)
>   - `code/packages/shared/src/types/protocol.ts:30-31` (CREATE_ROOM, JOIN_ROOM Zod schemas)
>   - `code/packages/client/src/app/lobby/page.tsx` (lobby UI with join-by-code input)
>   - `code/packages/client/src/app/lobby/[roomId]/page.tsx` (room waiting area with room code display)
>   - `code/packages/client/src/stores/roomStore.ts` (client room state management)
> - Tests:
>   - `code/packages/server/tests/room/room-manager.test.ts` (38 tests — room CRUD, code uniqueness, seat management, user tracking)
>   - `code/packages/server/tests/room/room-handler.test.ts` (19 tests — WebSocket message handling)
>   - `code/packages/shared/tests/types/protocol.test.ts` (protocol validation for new message types)

> **REQ-F-MP03** — Public lobby — *Passed*
> - Code:
>   - `code/packages/server/src/room/room-manager.ts:177-196` (getPublicRooms — filters private, returns LobbyEntry[])
>   - `code/packages/server/src/room/room-handler.ts:148-151` (handleGetLobby — sends LOBBY_LIST)
>   - `code/packages/shared/src/types/protocol.ts` (GET_LOBBY client message, LOBBY_LIST server message)
>   - `code/packages/client/src/app/lobby/page.tsx` (lobby page — room list with filtering, auto-refresh)
> - Tests:
>   - `code/packages/server/tests/room/room-manager.test.ts` (public rooms tests — list, exclude private, real-time updates)
>   - `code/packages/server/tests/room/room-handler.test.ts` (GET_LOBBY handler test)

> **REQ-F-MP04** — Room configuration options — *Passed*
> - Code:
>   - `code/packages/server/src/room/room-manager.ts:152-159` (configureRoom — partial config updates)
>   - `code/packages/server/src/room/room-handler.ts:108-127` (handleConfigureRoom — host-only config updates)
>   - `code/packages/shared/src/types/protocol.ts` (CONFIGURE_ROOM schema — targetScore, turnTimer, botDifficulty, animationSpeed, spectators, privacy)
>   - `code/packages/client/src/app/lobby/[roomId]/page.tsx` (room config form — sliders, selects, toggles for all settings)
> - Tests:
>   - `code/packages/server/tests/room/room-manager.test.ts` (configureRoom tests — update, partial update, reject during game)
>   - `code/packages/server/tests/room/room-handler.test.ts` (CONFIGURE_ROOM handler, host-only enforcement)

> **REQ-F-MP05** — Fixed seat partnerships — *Passed*
> - Code:
>   - `code/packages/server/src/room/room-manager.ts:93-99` (joinRoom — assigns seats in N/E/S/W order)
>   - `code/packages/client/src/app/lobby/[roomId]/page.tsx` (seat grid showing N+S vs E+W partnerships)
> - Tests:
>   - `code/packages/server/tests/room/room-manager.test.ts` (fixed seat partnerships test — N/E/S/W order)

> **REQ-F-AU01** — Guest access — *Passed*
> - Code:
>   - `code/packages/server/src/auth/guest.ts:1-56` (ensureGuestUser — create/update guest with correct displayName return, getUserById)
>   - `code/packages/server/src/auth/auth-routes.ts:16-23` (POST /api/auth/guest endpoint)
>   - `code/packages/server/src/db/schema.ts:10-20` (users table — isGuest flag, no email/password required)
>   - `code/packages/client/src/stores/authStore.ts:35-50` (initGuest action — persists userId to sessionStorage)
>   - `code/packages/client/src/app/auth/page.tsx:126-140` (skip-to-guest button — calls initGuest with generated ID/name)
> - Tests:
>   - `code/packages/server/tests/auth/guest.test.ts` (6 tests — create guest, update existing with correct displayName, insert called, getUserById)
>   - `code/packages/server/tests/auth/auth-routes.test.ts` (3 tests — guest endpoint, missing params)

> **REQ-F-AU02** — Optional account registration — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:1-135` (registerAccount, loginAccount, verifyToken with runtime shape validation — bcrypt + JWT)
>   - `code/packages/server/src/auth/auth-routes.ts:27-76` (POST /api/auth/register, /login, GET /me)
>   - `code/packages/server/src/db/schema.ts:13-17` (email + passwordHash columns on users table)
>   - `code/packages/client/src/stores/authStore.ts` (register, login, logout, loadFromStorage — cleans up orphaned user_id)
>   - `code/packages/client/src/app/auth/page.tsx` (login/register form with mode toggle)
> - Tests:
>   - `code/packages/server/tests/auth/account.test.ts` (12 tests — verifyToken valid/invalid/expired/wrong-secret/shape, registerAccount new/duplicate/upgrade/non-guest, loginAccount success/wrong-pwd/missing)
>   - `code/packages/server/tests/auth/auth-routes.test.ts` (13 tests — register/login validation + happy paths, /me auth)

> **REQ-F-AU03** — Game history persistence — *Passed*
> - Code:
>   - `code/packages/server/src/db/schema.ts:24-43` (games table — room, scores, players, FK refs to users)
>   - `code/packages/server/src/db/schema.ts:47-60` (gameRounds table — per-round scores, FK ref to games)
>   - `code/packages/server/src/db/schema.ts:64-76` (playerStats table — aggregated stats, FK ref to users)
>   - `code/packages/server/src/db/game-persistence.ts:1-265` (saveGameResult with transaction wrapping + atomic ON CONFLICT upsert, getPlayerGameHistory, getGameRounds)
>   - `code/packages/server/src/db/connection.ts:1-30` (Drizzle + postgres.js connection pool)
>   - `code/packages/server/src/auth/auth-routes.ts:88-110` (GET /players/:userId/games with NaN guard, /games/:gameId/rounds with NaN guard)
>   - `code/packages/client/src/app/profile/page.tsx` (game history list — supports ?userId URL param, error state)
> - Tests:
>   - `code/packages/server/tests/db/schema.test.ts` (8 tests — table names, column presence for all 4 tables)
>   - `code/packages/server/tests/db/game-persistence.test.ts` (10 tests — saveGameResult transaction/insert/stats, all-bot skip, tichu stats, getPlayerGameHistory, getGameRounds)
>   - `code/packages/server/tests/db/connection.test.ts` (2 tests — createDatabase returns shape, close calls client.end)
>   - `code/packages/server/tests/auth/auth-routes.test.ts` (5 tests — game history, rounds endpoints, NaN gameId returns 400)

> **REQ-F-AU04** — Leaderboard — *Passed*
> - Code:
>   - `code/packages/server/src/db/queries.ts:1-138` (getLeaderboard, getRecentGames, getPlayerProfile — cleaned imports)
>   - `code/packages/server/src/auth/auth-routes.ts:114-135` (GET /api/leaderboard with NaN guard, /games/recent with NaN guard)
>   - `code/packages/client/src/app/leaderboard/page.tsx` (leaderboard table — error state, NaN-safe rate formatting)
>   - `code/packages/client/src/app/profile/page.tsx` (player stats — supports viewing other players via ?userId)
> - Tests:
>   - `code/packages/server/tests/db/queries.test.ts` (7 tests — getLeaderboard with rows/empty, getRecentGames, getPlayerProfile exists/missing)
>   - `code/packages/server/tests/auth/auth-routes.test.ts` (6 tests — leaderboard, recent games, NaN limit returns 400)

> **REQ-NF-P02** — 60fps animations — *Passed*
> - Code:
>   - `code/packages/client/src/hooks/useAnimationSettings.ts:1-43` (animation duration multipliers, spring physics config)
>   - `code/packages/client/src/components/cards/CardHand.tsx:53-69` (Framer Motion spring animations — stiffness 300, damping 25)
>   - `code/packages/client/src/components/game/TrickDisplay.tsx:1-159` (GPU-accelerated card slide, trick sweep, bomb effect)
>   - `code/packages/client/src/app/globals.css` (`[data-animation-speed]` CSS overrides, `prefers-reduced-motion` support)
> - Tests:
>   - `code/packages/client/tests/hooks/useAnimationSettings.test.ts` (5 tests — all speed settings, disabled state)

> **REQ-NF-U01** — Responsive desktop + mobile — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/PlayerSeat.module.css` (640px mobile breakpoint — compact avatar + count)
>   - `code/packages/client/src/components/game/ScorePanel.module.css` (mobile collapsed score, bottom sheet history)
>   - `code/packages/client/src/components/cards/PhoenixValuePicker.module.css` (mobile bottom sheet)
>   - `code/packages/client/src/components/game/ChatPanel.module.css` (desktop 280px side panel, mobile bottom sheet)
> - Tests:
>   - `code/packages/client/tests/components/game/ChatPanel.test.tsx` (8 tests — panel open/close, send, unread badge)

> **REQ-NF-U02** — Configurable animation speed + prefers-reduced-motion — *Passed*
> - Code:
>   - `code/packages/client/src/hooks/useAnimationSettings.ts:1-43` (speed multipliers: slow 1.5x, normal 1x, fast 0.5x, off 0)
>   - `code/packages/client/src/stores/uiStore.ts` (animationSpeed setting in UI store)
>   - `code/packages/client/src/app/globals.css` (`prefers-reduced-motion: reduce` disables transitions)
>   - `code/packages/client/src/components/cards/CardHand.tsx:60` (motion initial/exit disabled when animations off)
> - Tests:
>   - `code/packages/client/tests/hooks/useAnimationSettings.test.ts` (5 tests — slow, normal, fast, off, enabled flag)

> **REQ-NF-U03** — Keyboard navigation — *Passed*
> - Code:
>   - `code/packages/client/src/hooks/useRovingTabIndex.ts:1-48` (roving tabindex: ArrowLeft/Right/Up/Down, Home, End)
>   - `code/packages/client/src/components/cards/CardHand.tsx:36,47-51` (containerRef, handleKeyDown on hand group)
>   - `code/packages/client/src/components/cards/Card.tsx` (tabIndex prop, data-card-id attribute)
> - Tests:
>   - Manual verification — keyboard focus moves between cards in hand

> **REQ-NF-U04** — Screen reader support — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/ChatPanel.tsx:74,86` (role="complementary", role="log", aria-live="polite")
>   - `code/packages/client/src/components/game/TichuBanner.tsx` (role="alert", aria-live="assertive")
>   - `code/packages/client/src/components/game/TrickArea.tsx` (aria-live="polite")
>   - `code/packages/client/src/components/game/DisconnectOverlay.tsx` (role="alertdialog", aria-modal)
>   - `code/packages/client/src/components/cards/CardHand.tsx:49` (role="group", aria-label="Your hand")
> - Tests:
>   - `code/packages/client/tests/components/game/ChatPanel.test.tsx` (aria-label assertions)
>   - `code/packages/client/tests/components/game/DisconnectOverlay.test.tsx` (6 tests — overlay rendering, vote buttons)
>   - `code/packages/client/tests/components/game/TichuBanner.test.tsx` (5 tests — banner rendering, auto-dismiss)

> **REQ-NF-U05** — WCAG AA color contrast — *Passed*
> - Code:
>   - `code/packages/client/src/app/globals.css` (`--color-text-muted: rgba(255,255,255,0.6)` — raised from 0.45 for AA compliance)
>   - `code/packages/client/src/components/cards/Card.module.css` (gold outline on selected: `2px solid var(--color-gold-accent)`)
> - Tests:
>   - Manual contrast ratio verification against WCAG AA 4.5:1 threshold

> **REQ-NF-U06** — 44×44px touch targets — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/ChatPanel.module.css` (44px min-height on send button, toggle button)
>   - `code/packages/client/src/components/game/DisconnectOverlay.module.css` (48px vote buttons)
>   - `code/packages/client/src/components/game/ActionBar.module.css` (min 44px action buttons)
> - Tests:
>   - Manual verification — all interactive elements meet 44×44px minimum

> **REQ-F-MP06** — Spectator mode — *Passed*
> - Code:
>   - `code/packages/client/src/app/spectate/[gameId]/page.tsx:1-115` (read-only spectator view — no hand, no action controls)
>   - `code/packages/client/src/app/spectate/[gameId]/spectate.module.css` (spectator badge, layout)
>   - `code/packages/server/src/ws/broadcaster.ts` (broadcastToSpectators method)
> - Tests:
>   - Manual verification — spectator sees game table, scores, trick display without interaction controls

> **REQ-F-MP07** — In-game text chat — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/ChatPanel.tsx:1-122` (chat panel: toggle, messages, send form)
>   - `code/packages/client/src/components/game/ChatPanel.module.css` (desktop side panel 280px, mobile bottom sheet)
>   - `code/packages/client/src/stores/uiStore.ts` (chatOpen, chatMessages, chatUnread, toggleChat, addChatMessage)
>   - `code/packages/client/src/app/game/[gameId]/page.tsx:38-44,146-149` (CHAT_RECEIVED handler, handleChatSend)
>   - `code/packages/shared/src/types/protocol.ts` (CHAT_MESSAGE, CHAT_RECEIVED schemas)
> - Tests:
>   - `code/packages/client/tests/components/game/ChatPanel.test.tsx` (8 tests — render, send, toggle, unread badge)
>   - `code/packages/client/tests/stores/uiStore-m15.test.ts` (chat state tests)

> **REQ-F-MP08** — Disconnect handling with vote — *Passed*
> - Code:
>   - `code/packages/client/src/components/game/DisconnectOverlay.tsx:1-86` (overlay with vote buttons, countdown, reconnect toast)
>   - `code/packages/client/src/components/game/DisconnectOverlay.module.css` (modal overlay, vote buttons, countdown)
>   - `code/packages/client/src/stores/uiStore.ts` (disconnectedSeat, disconnectVoteRequired, disconnectCountdown, reconnectedSeat)
>   - `code/packages/client/src/app/game/[gameId]/page.tsx:45-51,152-154` (PLAYER_DISCONNECTED/RECONNECTED handlers, handleDisconnectVote)
> - Tests:
>   - `code/packages/client/tests/components/game/DisconnectOverlay.test.tsx` (6 tests — disconnect notice, vote buttons, reconnect toast)
>   - `code/packages/client/tests/stores/uiStore-m15.test.ts` (disconnect state tests)

> **REQ-F-MP09** — Optional turn timer — *Passed*
> - Code:
>   - `code/packages/server/src/game/turn-timer.ts:1-82` (TurnTimer class)
>   - `code/packages/server/src/game/game-state-machine.ts:584-609` (handleTimeout auto-pass)
>   - `code/packages/client/src/components/game/ActionBar.tsx` (timer display integration)
> - Tests:
>   - `code/packages/server/tests/game/turn-timer.test.ts` (10 tests)

> **REQ-F-HV08** — Drag-and-drop via @dnd-kit — *Deferred*
> - Note: @dnd-kit not installed; deferred as non-critical enhancement. Click-to-select (REQ-F-HV07) provides full functionality.

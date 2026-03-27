# Requirements Traceability Matrix — Expert Bot Strategy Update

## Specification
- Source: `specifications/2026-03-26-expert-bot-strategy-update.md`
- Plan: `plans/tranquil-twirling-wreath.md` (`.claude/plans/`)

## Requirements

| ID | Description | Source Module | Milestone | Source File(s) | Test File(s) | Status |
|----|-------------|---------------|-----------|----------------|--------------|--------|
| REQ-F-STR01 | Hand strength detection (2+ power cards) | M1 | 1 | bot-strategy-utils.ts:hasStrength | bot-strategy-utils.test.ts | Passed |
| REQ-F-STR02 | Partner strength signal detection (received card < 10 or Dog) | M1 | 1 | expert-bot.ts:detectPartnerStrength | expert-bot.test.ts | Passed |
| REQ-F-CTX01 | Bot-runner passes context (scores, targetScore, roundState) to bot | M1 | 1 | bot-interface.ts:setContext, bot-runner.ts:provideContext, expert-bot.ts:setContext | expert-bot.test.ts | Passed |
| REQ-F-DEF01 | Prefer Aces as singletons | M2 | 4 | | | Pending |
| REQ-F-DEF02 | Prefer Aces late in round | M2 | 4 | | | Pending |
| REQ-F-DEF03 | Aces only for control or disruption | M2 | 4 | | | Pending |
| REQ-F-DEF04 | Prefer multi-card hands over breaking combos | M2 | 4 | | | Pending |
| REQ-F-DEF05 | Low-to-high rank order | M2 | 4 | | | Pending |
| REQ-F-DEF06 | Control probability for low multi-card leads | M2 | 4 | | | Pending |
| REQ-F-GT01 | Grand Tichu: 3+ power cards AND bomb | M3 | 2 | | | Pending |
| REQ-F-GT02 | Grand Tichu: 3+ power cards AND strong multi-card hand | M3 | 2 | | | Pending |
| REQ-F-GT03 | Grand Tichu: 2+ power + strong multi + opponents near winning | M3 | 2 | | | Pending |
| REQ-F-PASS01 | Strength concentration with hasStrength (2+ power cards) | M4 | 2 | | | Pending |
| REQ-F-PASS02 | 3rd-worst non-breaking card for strong hand partner pass | M4 | 2 | | | Pending |
| REQ-F-PASS03 | Parity convention (odd→left, even→right) | M4 | 2 | | | Pending |
| REQ-F-PASS04 | Anti-bomb: split low pair if no 2 singles below 8 | M4 | 2 | | | Pending |
| REQ-F-PASS05 | Never pass Dragon/Phoenix/Mahjong to opponents | M4 | 2 | | | Pending |
| REQ-F-PASS06 | Dog routing: opponent GT/T → Dog to opponent | M4 | 2 | | | Pending |
| REQ-F-PASS07 | Dog routing: strong hand → Dog to partner or right | M4 | 2 | | | Pending |
| REQ-F-PASS08 | Track passed-to-right for Mahjong wish | M4 | 2 | | | Pending |
| REQ-F-DOG01 | Context-dependent Dog play (unchanged) | M5 | — | expert-bot.ts | expert-bot.test.ts | Passed |
| REQ-F-PHX01 | Never play Phoenix over single < Ace unless all Aces accounted | M6 | 3 | | | Pending |
| REQ-F-PHX02 | Never play Phoenix in low multi-card (rank < 7) unless going out | M6 | 3 | | | Pending |
| REQ-F-PHX03 | Phoenix acceptable over Ace (prefer last unaccounted) | M6 | 3 | | | Pending |
| REQ-F-PHX04 | Phoenix acceptable over King if all Aces played | M6 | 3 | | | Pending |
| REQ-F-PHX05 | Phoenix acceptable in straight (rank >= 10 or length >= 5) | M6 | 3 | | | Pending |
| REQ-F-PHX06 | Phoenix acceptable in consecutive pairs | M6 | 3 | | | Pending |
| REQ-F-PHX07 | Phoenix acceptable in triple (rank >= 8) | M6 | 3 | | | Pending |
| REQ-F-PHX08 | Phoenix acceptable in pair (rank > 10) | M6 | 3 | | | Pending |
| REQ-F-PHX09 | Phoenix acceptable as singleton lead if rest are Ace/King/Dragon | M6 | 3 | | | Pending |
| REQ-F-BOMB01 | Never bomb against partner (broader rule) | M7 | 3 | | | Pending |
| REQ-F-BOMB02 | Bomb-proof exit exception: skip if can go out | M7 | 3 | | | Pending |
| REQ-F-MJ01 | Mahjong wish: straight + Ace/partner strength → no wish | M8 | 2 | | | Pending |
| REQ-F-MJ02 | Mahjong wish: right opponent GT → wish Ace | M8 | 2 | | | Pending |
| REQ-F-MJ03 | Mahjong wish: right opponent T + no partner strength → wish Ace | M8 | 2 | | | Pending |
| REQ-F-MJ04 | Mahjong wish: fallback → passed-to-right rank | M8 | 2 | | | Pending |
| REQ-F-END01 | Endgame strategy (unchanged) | M9 | — | expert-bot.ts | expert-bot.test.ts | Passed |
| REQ-F-TDEF01 | Risk-based Tichu defense (unchanged) | M10 | — | expert-bot.ts | expert-bot.test.ts | Passed |
| REQ-F-TRK01 | Card tracker + point tracking (unchanged) | M11 | — | card-tracker.ts | card-tracker.test.ts | Passed |
| REQ-F-TRK02 | Card tracker: allAcesPlayed, allAcesAccountedFor, isDragonPlayed | M11 | 1 | card-tracker.ts:allAcesPlayed,allAcesAccountedFor,isDragonPlayed | card-tracker.test.ts | Passed |
| REQ-F-FOL01 | King safety: treat Kings as Aces when all Aces accounted | M12 | 3 | | | Pending |
| REQ-F-FOL02 | Smart pass on low tricks (unchanged) | M12 | — | expert-bot.ts | expert-bot.test.ts | Passed |
| REQ-F-FOL03 | Split Aces exceptions: over Queen+ pairs or one-more-control | M12 | 3 | | | Pending |

# Specification: Expert Bot — Uncontested Singles Defense & Partner Tichu Support

**Version:** 1.0
**Date:** 2026-03-27
**Status:** Approved
**Confidence:** High — All requirements are clear, testable, and non-conflicting with existing strategy modules.

## 1. Goal

Add two new strategy domains to the expert bot:
1. **Uncontested Singles Defense (USD)** — Detect and counter opponents who are winning cheap single-card tricks without resistance, by selectively breaking multi-card hands to contest.
2. **Partner Tichu Support (PTS)** — When partner has called Grand Tichu or Tichu, actively support their call by giving them control, avoiding going out first, and playing cooperatively.

These strategies address two gaps in the current expert bot: passive acceptance of opponent's cheap singles, and lack of proactive partner support during Tichu calls.

## 2. Context & Background

The expert bot (M1-M12) implements 12 strategy modules covering hand evaluation, card passing, play selection, bomb timing, Phoenix/Dog usage, endgame, and Tichu defense. However, it currently:
- Does not track or react to opponents winning uncontested single tricks
- Has limited partner Tichu support (saves Dog via M5, but no active lead-transfer or go-out suppression)
- Always passes when partner is winning (no nuanced overplay on low tricks)

**Existing files:**
- `code/packages/server/src/bot/expert-bot.ts` — Main ExpertBot class (1,437 lines)
- `code/packages/server/src/bot/bot-strategy-utils.ts` — Shared utility functions
- `code/packages/server/src/bot/card-tracker.ts` — Card tracker
- `code/packages/server/tests/bot/expert-bot.test.ts` — Tests

## 3. Requirements

### 3.1 Functional Requirements — Uncontested Singles Defense (USD)

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-USD01 | Track per-opponent uncontested single card trick wins. A trick is "uncontested" when all other active players passed. Reset the counter when the trick type changes (a non-single trick is played). | Must | Counter increments on uncontested single wins; resets on non-single tricks; resets on new round. |
| REQ-F-USD02 | If an opponent wins 2+ uncontested single tricks with rank < Jack (< 11), break apart the weakest multi-card hand whose freed card can beat the opponent's likely next single. Break priority order: pairs before triples before full house before longer combos. | Must | Bot breaks a pair to contest when opponent has won 2 cheap uncontested singles; does NOT break if freed card can't beat opponent's last single rank. |
| REQ-F-USD03 | When partner called Grand Tichu or Tichu, lower the threshold: break combos if opponents win uncontested singles with rank < Queen (< 12). Only 1 uncontested win needed to trigger (more protective of partner's call). | Must | With partner GT/T, bot breaks combo after just 1 uncontested opponent single < Queen. |

### 3.2 Functional Requirements — Partner Tichu Support (PTS)

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-PTS01 | When partner called GT/T and bot has the lead, play Dog to transfer control to partner. | Must | Bot leads Dog when partner called GT/T and Dog is in hand. |
| REQ-F-PTS02 | When partner called GT/T, bot has the lead, and no Dog available — lead with lowest single card. | Must | Bot leads lowest single when partner called GT/T and no Dog. |
| REQ-F-PTS03 | Track partner's last pass behavior across trick boundaries. If partner passes on bot's low single lead, next time bot leads, escalate to a low pair. Continue escalating progressively (low triple, low straight, etc.) until partner can play. | Must | Bot tracks `partnerLastPassedOnType` and escalates lead type across tricks. Resets on round change. |
| REQ-F-PTS04 | When partner called GT/T and following on opponent's trick, play more aggressively to win the trick (so bot can then lead Dog/low card to partner). Prefer winning with minimum force but do not pass when normally would. | Must | Bot plays to win opponent tricks more often when partner called GT/T, even on low-value tricks it would normally pass. |
| REQ-F-PTS05 | When partner called GT/T, suppress go-out-first plays. Do not go out first to protect partner's Tichu call, unless REQ-F-PTS06 applies. | Must | Bot does not play a go-out combo when partner called GT/T and partner is still in the game. |
| REQ-F-PTS06 | Exception to PTS05: If both partner AND an opponent called Tichu, partner has 8+ cards, opponent has 3 or fewer cards, AND bot has a very high chance of going out before both — then go out first to nullify both Tichus. "Very high chance" means: (a) bot has 3 or fewer cards and all are winners (Aces, Dragon, bombs), OR (b) bot has winners plus multi-card hands with rank >= 10 or hand length > opponent's remaining cards, with a higher-ranked backup to beat a contest. | Should | Bot goes out first only when nullification conditions are met; does NOT go out if conditions aren't met. |
| REQ-F-PTS07 | When partner has NOT called GT/T, bot may play over partner's winning single, pair, or triple trick IF: (a) the rank difference between bot's play and partner's trick is 4 or less, AND (b) partner's trick rank is below 10. | Should | Bot overplays partner's low trick (e.g., partner's 5, bot plays 7) but passes on partner's high tricks (rank >= 10). |

### 3.3 Constraints

- Must integrate with existing `choosePlay`, `chooseLeadPlay`, and `chooseFollowPlay` methods
- Must not regress any existing M1-M12 strategy behavior
- New state fields must reset on round change (consistent with existing pattern)
- PTS01-PTS06 must take priority over normal lead/follow logic when partner called GT/T

### 3.4 Assumptions

- `roundState` provides sufficient trick history to detect uncontested singles (trick plays with pass count)
- The bot can determine which player won a trick and whether it was uncontested from `roundState.tricks`
- Partner's GT/T call is available via `roundState.players[partner].tipiCall`

## 4. Scope

### 4.1 In Scope

- New state tracking: uncontested singles counter, partner-pass-on-type tracker
- New method: combo-breaking logic for USD
- Modified methods: `chooseLeadPlay`, `chooseFollowPlay`, `choosePlay`
- New tests for all USD and PTS requirements
- RTM updates

### 4.2 Out of Scope

- Changes to card passing logic (M4)
- Changes to bomb timing (M7)
- Changes to Mahjong wish (M8)
- UI changes
- Changes to `card-tracker.ts` or `bot-strategy-utils.ts` (unless utility functions are needed)

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|---------|------------------|
| EC-001 | Opponent wins uncontested single with exactly a Jack (rank 11) | USD02 does NOT trigger (threshold is < Jack) |
| EC-002 | Opponent wins 2 uncontested singles but bot has no breakable combo that beats the rank | Bot does not break any combo; plays normally |
| EC-003 | Partner called GT/T but is already out of the game | PTS01-PTS06 deactivate; normal play resumes |
| EC-004 | Partner called GT/T and bot has only multi-card hands (no singles) | PTS02 skipped; bot leads lowest available combo |
| EC-005 | PTS06 conditions met but bot has 0 winners | Bot does NOT go out (fails "very high chance" test) |
| EC-006 | Partner's trick rank is exactly 10 | PTS07 does NOT apply (rank must be below 10) |
| EC-007 | Rank difference is exactly 4 | PTS07 DOES apply (4 or less) |
| EC-008 | Both USD03 and PTS04 apply simultaneously | PTS04 takes priority (aggressive follow > combo breaking) |
| EC-009 | Partner passes on bot's pair lead but bot has no triple to escalate to | Bot leads next available combo type (straight, etc.) or falls through to normal lead |
| EC-010 | Bot has Dog and partner called GT/T but only 2 players remain | Dog cannot be played in 2-player (Dog passes lead); endgame logic takes precedence |

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | PTS03 escalation tracking adds cross-trick state complexity | Medium | Low | Reset on round change; simple field tracking |
| R-002 | USD combo-breaking may weaken hand unnecessarily | Medium | Medium | Only break if freed card beats opponent's rank; prefer weakest combo |
| R-003 | PTS05 go-out suppression could trap the bot | Low | Medium | PTS06 provides escape hatch; endgame logic still applies |
| R-004 | PTS06(b) "statistically likely" heuristic may be too loose/strict | Medium | Low | Concrete rules: rank >= 10 OR length > opponent cards |

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| All new requirements have passing tests | 100% | `buildtool test` |
| Statement coverage for new code | >= 80% | Coverage report |
| No regression in existing tests | 0 failures | Full test suite |
| Each requirement traceable in RTM | All Passed | RTM review |

## 8. Open Questions

None — all questions resolved during elicitation.

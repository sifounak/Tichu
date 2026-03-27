# Expert Bot Partner Support & Uncontested Singles Defense — Specification

## Summary

Built specification for two new strategy domains in the expert bot:

1. **Uncontested Singles Defense (USD)** — Track opponents winning cheap single tricks uncontested, break weakest multi-card hands to contest (REQ-F-USD01-USD03)
2. **Partner Tichu Support (PTS)** — Active support for partner's GT/T call: Dog lead, escalating low leads, aggressive follow, go-out suppression, nullification exception, and low-trick overplay (REQ-F-PTS01-PTS07)

### Key Decisions

- Uncontested = all other active players passed; counter resets on non-single trick type change
- Break priority: pairs > triples > full house > longer combos; only if freed card beats opponent rank
- Partner GT/T thresholds are stricter: 1 uncontested win with rank < Queen (vs 2 wins with rank < Jack)
- PTS03 escalation tracked across trick boundaries via `partnerLastPassedOnType`
- PTS06 nullification requires: partner 8+ cards, opponent 3 or fewer, bot very high chance of going out
- "Very high chance": (a) 3 or fewer cards all winners, OR (b) winners + multi-card rank >= 10 or length > opponent cards
- PTS07 low-trick overplay: rank diff <= 4 AND partner rank < 10, only when partner has NOT called GT/T
- PTS04 takes priority over USD03 when both apply

### Clarifying Questions & Answers

1. **Uncontested definition**: All other active players passed. Counter resets when trick type changes.
2. **Combo breaking evaluation**: Only break if freed card can beat opponent's single rank.
3. **"Whatever you can" for partner support**: Play more aggressively to win tricks, then feed partner.
4. **"Seems like opponent will go out first"**: Partner 8+ cards, opponent 3 or fewer cards. Bot must have very high chance of going out before both.
5. **"Very, very good chance"**: (a) 3 or fewer cards all winners, OR (b) winners + strong multi-card hands (rank >= 10 or length > opponent cards) with backup to beat contest.
6. **Partner overplay rule**: OK to play over partner's low single/pair/triple if rank diff <= 4 and partner rank < 10, only when partner has NOT called GT/T.

### Confidence: High
All requirements clear, testable, non-conflicting.

## Specification Files
- `specifications/2026-03-27-expert-bot-partner-support.md` — Full specification
- `specifications/2026-03-26-expert-bot-strategy-update.md` — Updated with M13 and M14 modules

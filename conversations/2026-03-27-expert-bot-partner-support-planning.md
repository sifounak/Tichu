# Expert Bot Partner Support & USD — Planning

## Summary

Designed a 3-milestone implementation plan for Uncontested Singles Defense (M13) and Partner Tichu Support (M14) strategy modules.

### Key Design Decisions

1. **Detecting uncontested singles**: Use `tricksWon` entry length — if exactly 1 card, it was uncontested. Track `lastTricksWonCounts` per seat to detect new entries between calls.

2. **PTS03 escalation**: Simple heuristic — if bot keeps getting the lead back when partner has GT/T, escalate combo type. Track `ptsConsecutiveLeads` count. No complex pass detection needed.

3. **shouldSaveDog conflict resolution**: Existing `shouldSaveDog` saves Dog when partner called Tichu. PTS01 requires the opposite (play Dog). Fix: insert PTS lead check BEFORE shouldSaveDog in chooseLeadPlay.

4. **Go-out suppression scope**: Wrap all `canGoOut` calls in lead, follow, and 1-2 prevention. Do NOT suppress in endgame (endgame overrides PTS).

### Milestones

- **M5**: Uncontested Singles Defense (USD01-03) — tracking + combo breaking
- **M6**: Partner Tichu Lead Support (PTS01-03) — Dog play, low leads, escalation
- **M7**: Partner Follow, Go-Out Suppression, Overplay (PTS04-07)

### Files

- Plan: `plans/2026-03-27-expert-bot-partner-support.md`
- RTM updated: `specifications/RTM-expert-bot-strategy-update.md`

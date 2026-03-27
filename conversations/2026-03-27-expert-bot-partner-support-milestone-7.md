# Expert Bot Partner Support — Milestone 7: Partner Follow, Go-Out Suppression, Overplay

## Summary

Implemented M14 Partner Tichu follow, go-out suppression, and low-trick overplay:
- PTS04: Aggressive follow to win tricks for partner's GT/T
- PTS05: Suppress go-out-first when partner called GT/T
- PTS06: Nullification exception — allow go-out when both partner and opponent called Tichu
- PTS07: Low-trick overplay when partner has NOT called GT/T

## Key Implementation Details

- Added `shouldSuppressGoOut()` combining PTS05/PTS06 logic
- Added `isVeryHighGoOutChance()` for PTS06 criteria
- Modified `chooseFollowPlay()` with:
  - PTS07 check in partner-winning block (before pass)
  - PTS04 aggressive follow block (after partner-winning)
  - PTS05 go-out suppression in both go-out checks
- Wrapped `canGoOut` with `!shouldSuppressGoOut` in:
  - `chooseFollowPlay` (2 locations)
  - `chooseLeadPlay` (1 location)
  - `chooseOneTwoPreventionPlay` (1 location)
  - NOT in `chooseEndgamePlay` (endgame overrides PTS)
- Fixed 3 test setups where single-card hands triggered go-out before PTS07 checks

## Tests: 111 passed, 0 failed

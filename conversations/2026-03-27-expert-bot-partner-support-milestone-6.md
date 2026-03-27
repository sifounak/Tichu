# Expert Bot Partner Support — Milestone 6: Partner Tichu Lead Support

## Summary

Implemented M14 Partner Tichu Lead Support with 3 requirements:
- PTS01: Play Dog when partner called GT/T to transfer control
- PTS02: Lead lowest single when no Dog and partner GT/T
- PTS03: Escalate combo type (single → pair → triple → straight) on consecutive PTS leads

## Key Implementation Details

- Added `hasPartnerTichuCall()` helper for checking partner's tipiCall
- Added `choosePTSLeadPlay()` with Dog-first, single-fallback, escalation logic
- Inserted PTS check in `chooseLeadPlay` BEFORE shouldSaveDog block — PTS01 overrides DOG01's "save Dog for partner Tichu"
- Track `ptsConsecutiveLeads` and `lastLeadSeat` for escalation
- Updated existing test "saves Dog when partner called Tichu" to reflect PTS01 override

## Tests: 99 passed, 0 failed

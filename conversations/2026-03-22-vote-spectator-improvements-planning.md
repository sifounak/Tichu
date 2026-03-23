# Conversation: Vote & Spectator Improvements — Planning

**Date:** 2026-03-22
**Phase:** Planning
**Branch:** feature/player-vote-kick-restart

## Summary

Created 4-milestone implementation plan based on approved specification.

### Milestones
1. **M1**: Bot kick bug fix + UI polish (REQ-F-VI01/02/16/17/18) — server fix + CSS changes
2. **M2**: Spectator vote notifications (REQ-F-VI06/07) — VoteOverlay readOnly prop
3. **M3**: Host add bot mid-game (REQ-F-VI03/04/05) — server + client changes
4. **M4**: Pre-game kick voting (REQ-F-VI08-15, REQ-NF-VI01-03) — new message types, room-level VoteHandler, PreRoomView UI

### Key Design Decisions
- M1 groups the foundational bug fix with trivial CSS changes to keep first milestone simple
- Pre-game voting uses distinct message types (PRE_GAME_KICK_VOTE, PRE_GAME_VOTE) to avoid router conflicts
- Mid-game bot addition reuses existing registerBot() + handleSeatFilled() flow

### Files
- Plan: `plans/2026-03-22-vote-spectator-improvements.md`
- RTM: `specifications/RTM-vote-spectator-improvements.md`

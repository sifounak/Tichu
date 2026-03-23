# Conversation: Player Vote Feature — Specification Phase

**Date:** 2026-03-22
**Feature:** Player Vote System (Kick Player / Restart Game)
**Phase:** Specification

## Summary

### Goal
Add a democratic voting system allowing human players to collectively vote to kick a player or restart the game during active gameplay.

### Key Decisions
1. **Architecture:** Standalone VoteHandler class modeled after existing DisconnectHandler — operates independently of XState game state machine (REQ-NF-PV04)
2. **Vote thresholds:** Unanimous approval required — all eligible human voters must agree (REQ-F-PV13, REQ-F-PV14)
3. **Visual feedback:** Reuse existing PlayerSeat glow/label system — green for approve, red for reject (REQ-F-PV10, REQ-F-PV11)
4. **State hiding:** Temporarily suppress normal game indicators during votes, restore after (REQ-F-PV09, REQ-F-PV12)
5. **Timeout:** 30 seconds auto-fail (REQ-F-PV15)
6. **Kick execution:** Reuse existing KICKED message and seat vacancy system (REQ-F-PV16)
7. **Restart execution:** Destroy and recreate GameManager with same config, reset scores to 0-0 (REQ-F-PV18)
8. **Mutual exclusion:** Only one vote at a time per room; cannot start during disconnect vote (REQ-F-PV25)

### Requirements Count
- 28 functional requirements (REQ-F-PV01 through REQ-F-PV28)
- 4 non-functional requirements (REQ-NF-PV01 through REQ-NF-PV04)

### Specification File
`specifications/2026-03-22-player-vote-kick-restart.md`

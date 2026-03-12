# Specification & Planning: WebSocket Reconnection & Seat Swap

**Date:** 2026-03-12
**Phase:** Specification + Planning

## Summary

Formalized the approved plan for fixing broken room page navigation (WebSocket reconnection bug) and adding seat swap feature. Plan was previously analyzed and approved — this session verified all code assumptions against current codebase and found all line numbers and function signatures match exactly.

## Key Decisions

- 2 milestones: M1 for reconnection fix (critical), M2 for seat swap (enhancement)
- Server-side reconnection approach: detect returning user in `addClient` flow, restore room membership
- Client-side: 150ms timing guard to allow server reconnection to arrive before attempting fresh join
- Seat swap supports 3 modes: empty seat, bot seat, human-to-human swap

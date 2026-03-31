# Stats Page Overhaul — Planning Conversation

## Summary

**Plan:** 4 milestones, sequential dependency chain.

**Milestones:**
1. Shared Types + DB Schema + Stat Computations (REQ-F-SO01–SO11)
2. Game Persistence + Spectator Tracking + API Expansion (REQ-F-SO12–SO20)
3. Client UI — Overview Tab + Card Stats Tab (REQ-F-SO21–SO27)
4. Client UI — History Tab Redesign (REQ-F-SO28–SO29)

**Key Decisions:**
- 4 milestones (not more) since changes are tightly coupled within each layer
- M1 and M2 are backend-only; M3 and M4 are client-only
- Spectator tracking requires changes to both GameManager and RoomHandler (M2)
- History tab enrichment via server-side JOIN (not N+1 client queries)
- RTM created with all 29 FR + 3 NFR mapped to milestones

**RTM:** `specifications/RTM-stats-page-overhaul.md`

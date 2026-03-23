# Requirements Traceability Matrix — Player Vote System

| Req ID | Description | Milestone | Source File(s) | Test | Status |
|---|---|---|---|---|---|
| REQ-F-PV01 | Start a Vote button | M3 | page.tsx | Manual | Pending |
| REQ-F-PV02 | Vote dropdown menu | M3 | page.tsx | Manual | Pending |
| REQ-F-PV03 | Kick Player target selection | M3 | page.tsx | Manual | Pending |
| REQ-F-PV04 | Restart Game initiation | M3 | page.tsx | Manual | Pending |
| REQ-F-PV05 | Kick vote dialog | M4 | VoteOverlay.tsx | Manual | Pending |
| REQ-F-PV06 | Kick target notification | M4 | VoteOverlay.tsx | Manual | Pending |
| REQ-F-PV07 | Restart vote dialog | M4 | VoteOverlay.tsx | Manual | Pending |
| REQ-F-PV08 | Vote submission | M3 | page.tsx | Manual | Pending |
| REQ-F-PV09 | State hiding during vote | M4 | PlayerSeat.tsx | Manual | Pending |
| REQ-F-PV10 | Kick vote glow indicators | M4 | PlayerSeat.tsx, PlayerSeat.module.css | Manual | Pending |
| REQ-F-PV11 | Restart vote glow indicators | M4 | PlayerSeat.tsx, PlayerSeat.module.css | Manual | Pending |
| REQ-F-PV12 | State restoration after vote | M4 | PlayerSeat.tsx | Manual | Pending |
| REQ-F-PV13 | Kick vote pass threshold | M5 | vote-handler.ts | Build | Pending |
| REQ-F-PV14 | Restart vote pass threshold | M5 | vote-handler.ts | Build | Pending |
| REQ-F-PV15 | Vote timeout | M1 | vote-handler.ts | Build | Pending |
| REQ-F-PV16 | Kick vote success result | M5 | game-manager.ts | Manual | Pending |
| REQ-F-PV17 | Kick vote failure result | M5 | page.tsx | Manual | Pending |
| REQ-F-PV18 | Restart vote success result | M5 | game-manager.ts, game-store.ts | Manual | Pending |
| REQ-F-PV19 | Restart vote failure result | M5 | page.tsx | Manual | Pending |
| REQ-F-PV20 | Client-to-server messages | M1 | protocol.ts | Build | Pending |
| REQ-F-PV21 | Server-to-client messages | M1 | protocol.ts | Build | Pending |
| REQ-F-PV22 | Server-authoritative vote logic | M1, M2 | vote-handler.ts, game-manager.ts | Build | Pending |
| REQ-F-PV23 | Active vote in state projection | M2 | state-projection.ts, game.ts | Build | Pending |
| REQ-F-PV24 | Single human auto-pass | M5 | vote-handler.ts | Manual | Pending |
| REQ-F-PV25 | Concurrent vote prevention | M2, M5 | game-manager.ts, vote-handler.ts | Manual | Pending |
| REQ-F-PV26 | Initiator disconnect cancels vote | M5 | vote-handler.ts, game-manager.ts | Manual | Pending |
| REQ-F-PV27 | Target disconnect cancels kick vote | M5 | vote-handler.ts, game-manager.ts | Manual | Pending |
| REQ-F-PV28 | Cannot kick self | M5 | game-manager.ts | Manual | Pending |
| REQ-NF-PV01 | Real-time feedback | M2, M5 | vote-handler.ts, broadcaster.ts | Manual | Pending |
| REQ-NF-PV02 | Consistent UI patterns | M4 | VoteOverlay.tsx, PlayerSeat.tsx | Manual | Pending |
| REQ-NF-PV03 | Accessibility | M4 | VoteOverlay.tsx | Manual | Pending |
| REQ-NF-PV04 | No game state machine modification | M1 | vote-handler.ts | Inspection | Pending |

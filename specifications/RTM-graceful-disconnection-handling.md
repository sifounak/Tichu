# Requirements Traceability Matrix — Graceful Disconnection Handling

## Spec: `specifications/2026-05-09-graceful-disconnection-handling.md`

| Requirement | Description | Milestone | Source File(s) | Test File(s) | Status |
|---|---|---|---|---|---|
| REQ-F-DC01 | Mark disconnected, preserve seat | M1 | | | Pending |
| REQ-F-DC02 | Timer starts from zero each disconnect | M1 | | | Pending |
| REQ-F-DC03 | Timer fully reset on reconnect | M1 | | | Pending |
| REQ-F-DC04 | Track elapsed disconnect time per player | M1 | | | Pending |
| REQ-F-GF01 | No pause/freeze/auto-play on disconnect | M1 | | | Pending |
| REQ-F-GF02 | Timed phases: turn timer runs, auto-action on expiry | M1 | | | Pending |
| REQ-F-GF03 | Bomb window runs naturally for disconnected | M1 | | | Pending |
| REQ-F-GF04 | Untimed phases: wait indefinitely for disconnected player | M1 | | | Pending |
| REQ-F-UI01 | "Waiting for reconnect" overlay on untimed turn | M4 | | | Pending |
| REQ-F-UI02 | No visual indicator outside untimed turn | M4 | | | Pending |
| REQ-F-UI03 | Spectators see overlay, not kick dialog | M2/M4 | | | Pending |
| REQ-F-KM01 | Kick dialog at 2 min + 5 sec delay | M2 | | | Pending |
| REQ-F-KM02 | Any single kick triggers immediate removal | M2 | | | Pending |
| REQ-F-KM03 | All decline → dismissed | M2 | | | Pending |
| REQ-F-KM04 | Kicked seat follows vacancy logic | M2 | | | Pending |
| REQ-F-KM05 | Reconnect dismisses kick dialog | M2 | | | Pending |
| REQ-F-KM06 | Sequential kick dialogs for multiple disconnects | M2 | | | Pending |
| REQ-F-KM07 | Kick dialog non-blocking | M2 | | | Pending |
| REQ-F-KM08 | Queue ordered by threshold crossing time | M2 | | | Pending |
| REQ-F-KM09 | Queued player reconnects → removed silently | M2 | | | Pending |
| REQ-F-KM10 | One-time per disconnect session (player dismiss) | M2 | | | Pending |
| REQ-F-KM11 | New disconnect session → new dialog eligibility | M2 | | | Pending |
| REQ-F-KM12 | Vote dismisses kick dialog; reappears after | M3 | | | Pending |
| REQ-F-KM13 | System-dismiss allows reappearance | M3 | | | Pending |
| REQ-F-KM14 | Kick dialog identical for all players | M2 | | | Pending |
| REQ-F-VI01 | 2+ min disconnected excluded from votes | M3 | | | Pending |
| REQ-F-VI02 | < 2 min disconnected participates normally | M3 | | | Pending |
| REQ-F-VI03 | Crossing threshold during vote → dismiss vote | M3 | | | Pending |
| REQ-F-VI04 | After vote dismiss → show kick dialog | M3 | | | Pending |
| REQ-F-VI05 | After kick resolved → restart prior vote (unless moot) | M3 | | | Pending |
| REQ-F-VI06 | Reconnect during kick → dismiss, restart prior vote | M3 | | | Pending |
| REQ-F-VI07 | < 2 min disconnected during vote → vote waits (30s timeout) | M3 | | | Pending |
| REQ-F-VI08 | Turn timer paused during vote | M3 | | | Pending |
| REQ-F-VI09 | Turn timer reset to full after vote | M3 | | | Pending |
| REQ-NF-DC01 | No latency/performance degradation | M5 | | | Pending |
| REQ-NF-DC02 | Timer accurate to ±2 seconds | M5 | | | Pending |
| REQ-NF-UI01 | Overlay appears within 1 second | M4 | | | Pending |
| REQ-NF-GF01 | Bomb window duration identical regardless of disconnect | M1 | | | Pending |

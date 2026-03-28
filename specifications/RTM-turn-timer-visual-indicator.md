# Requirements Traceability Matrix — Turn Timer Visual Indicator

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|----------------|--------------|--------|
| REQ-F-TT01 | Countdown badge next to turn label | M3, M4 | PlayerSeat.tsx:219-225, PlayerSeat.module.css:.timerBadge | — | Passed |
| REQ-F-TT02 | Depleting SVG border ring | M3, M4 | TurnTimer.tsx, TurnTimer.module.css, PlayerSeat.tsx:157 | — | Passed |
| REQ-F-TT03 | Three-stage color transition (blue/amber/red) | M3, M4 | useTurnTimer.ts:getStage, TurnTimer.module.css:.blue/.amber/.red, PlayerSeat.module.css:.timerAmber/.timerRed | — | Passed |
| REQ-F-TT04 | Critical stage pulse animation (synced 1s) | M3 | TurnTimer.module.css:timerRingPulse, PlayerSeat.module.css:timerGlowPulse/timerBadgePulse/timerTextPulse | — | Passed |
| REQ-F-TT05 | Server timer data in ClientGameView | M1 | turn-timer.ts:getStartTime/getDurationMs, state-projection.ts, broadcaster.ts, game-manager.ts, game.ts | — | Passed |
| REQ-F-TT06 | Client-side countdown hook | M2 | useTurnTimer.ts | — | Passed |
| REQ-F-TT07 | No timer display when disabled | M1, M4 | useTurnTimer.ts:INACTIVE, PlayerSeat.tsx:timerActive guard | — | Passed |

# Milestone 10: Bot Framework + EasyBot — Conversation Transcript

**Date:** 2026-03-11
**Branch:** feature/tichu-web-game
**Milestone:** 10 of 15

## Summary

Implemented the bot framework for the Tichu web game, enabling any combination of human and bot players.

### What was implemented

1. **Bot Strategy Interface** (`bot-interface.ts`)
   - `BotStrategy` interface with methods for all game phases: Grand Tichu, Regular Tichu, card passing, play selection, Dragon gift, Mahjong wish
   - `BotPlayContext` type providing bot with hand, trick state, valid plays, and round context
   - `BotPlayDecision` discriminated union for play/pass decisions

2. **EasyBot** (`easy-bot.ts`)
   - Always passes on Grand/Regular Tichu calls
   - Passes random cards to other players
   - Randomly selects from valid plays (30% chance to pass when allowed)
   - Random Dragon gift recipient, no Mahjong wish

3. **Bot Runner** (`bot-runner.ts`)
   - Manages bot instances per seat
   - Handles all game phases: triggers bot decisions at the right time
   - Configurable artificial thinking delay (200-1500ms default, instant for testing)
   - Proper cleanup with dispose pattern
   - Mahjong wish declaration after playing Mahjong

### Key decisions

- Bot runner uses `setTimeout(0)` for instant mode to avoid reentrant `actor.send()` during state transitions
- EasyBot has a 30% pass rate to simulate natural play variety
- `BotPlayContext` includes full `RoundState` to support future smarter bots
- `INSTANT_CONFIG` exported for testing use

### Test results

- 30 new tests (16 EasyBot + 14 BotRunner)
- Full 4-bot game smoke test runs to completion
- 220 total tests pass across server package
- Coverage: easy-bot 100%, bot-runner 98.95%, overall server 95.66%

### Requirements addressed

- REQ-F-BOT01: Bot strategy interface — Passed
- REQ-F-BOT02: EasyBot implementation — Passed
- REQ-F-BOT05: Artificial thinking delay — Passed
- REQ-F-MP01: Any combination 0-4 humans + bots — Passed

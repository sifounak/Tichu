# Hard & Expert Bot — Specification Conversation

**Date:** 2026-03-16
**Phase:** Specification (Phase 1.2)
**Branch:** feature/hard-bot

## Summary of Key Decisions

1. **Two new bots**: HardBot (strong intermediate) and ExpertBot (near-expert), plus the existing RegularBot
2. **Information model**: No peeking at opponent hands — bots use only human-available information
3. **Hard bot**: Per-trick evaluation, heuristic strategy, 10-15% randomness, no card counting, no score awareness
4. **Expert bot**: Full hand planning at round start, always optimal play, top-10 card counting + absent rank bomb detection, score-aware decisions, aggressive one-two prevention
5. **Shared architecture**: All three bots compose from `bot-strategy-utils.ts` — RegularBot uses minimal strategy, HardBot uses heuristics, ExpertBot adds planning
6. **Partner awareness**: Both bots play as if partner is competent regardless of partner's actual bot type
7. **Opponent Tichu defense**: Both Hard and Expert bots react to opponent Tichu calls
8. **Phoenix decision**: Expert bot decides during hand planning (singleton-killer vs wild) and sticks with it; Hard bot picks best use at the moment
9. **Dog passing**: Strategic, not a hard rule — pass to opponent who called Grand Tichu; pass to partner when own hand is weak
10. **Three bug fixes added**: Round-ending edge cases, Dog animation timing (1s pause + 1s sweep), Phoenix singleton display (contextual value with named face cards)
11. **Difficulty tiers**: Updated to `regular | hard | expert` across types, protocol, server, and client UI
12. **Injectable randomness**: For deterministic testing of Hard bot's suboptimal play paths
13. **Full-game simulation**: Deferred to later — quality verified through unit tests on individual decisions

## Strategy Sources

- Spotlight on Games, Aaron Fuegi's guide, Steve's HFoG Blog
- Key principles: lead low/win high, split Aces, hold Dragon, Dog is valuable, Phoenix is best card, bombs are one lead, strategic Mahjong wishes, partner support, strategic passing, defend against Tichu

## Pre-Specification Work

- Merged `feature/simplify-bot-difficulty` into main (squash commit): renamed EasyBot → RegularBot, simplified tiers from easy/medium/hard to regular/hard
- Created `feature/hard-bot` branch from main

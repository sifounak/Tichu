# Phoenix Strategy Fix — Specification

## Problem

The bot plays Phoenix as a singleton on low/mid-rank cards when it shouldn't, and blocks Phoenix from efficient multi-card combos.

### Issue 1: Singleton Phoenix not cascading down ranks

**Current**: REQ-F-PHX01 blocks Phoenix singleton on trick rank < Ace unless all Aces are accounted for. Once all Aces ARE accounted for, Phoenix plays on anything (5, 8, Queen, etc.) — there's no further cascading check.

**Expected**: Phoenix singleton should only be played on rank R if all ranks above R are accounted for (played or in own hand). Examples:
- Over Ace → always acceptable (highest standard rank)
- Over King → only if all Aces accounted for
- Over Queen → only if all Aces AND Kings accounted for
- Over Jack → only if all Aces, Kings AND Queens accounted for
- etc.

### Issue 2: Multi-card Phoenix blocked for efficient low combos

**Current**: REQ-F-PHX02 blocks Phoenix in any combo with rank < 7 (unless going out). This blocks long straights (e.g., 2-3-4-5-6 with Phoenix as the 4) that efficiently clear many losers. PHX02 fires before PHX05 can accept length >= 5 straights.

**Expected**: Long combos (4+ cards) that clear many losers should be acceptable even at low rank. Phoenix as gap-filler in a long low straight is a strong play. Only block short low combos (2-3 cards at rank < 7).

## Requirements

### REQ-F-PHX01a: Cascading singleton Phoenix guard
Phoenix singleton on trick rank R is 'never' unless all standard ranks above R are accounted for (played or in own hand).

### REQ-F-PHX02a: Length-aware multi-card guard
Phoenix in multi-card combo where the **trick rank** (combo.rank) < 7 is 'never' only when combo length < 4 and not going out. Combos of 4+ cards are exempt — they clear enough losers to justify Phoenix use. Note: "trick rank" is the combination rank (e.g., 6 for a full house 6s full of 2s, regardless of what rank Phoenix substitutes for).

### REQ-F-PHX03a: Cascading singleton Phoenix acceptance
Phoenix singleton on rank R is 'acceptable' when all ranks above R are accounted for.

### REQ-F-TRK03: Generic rank accounting query
CardTracker gains `allRanksAboveAccountedFor(rank)` method checking ranks rank+1 through 14.

## Files to Modify

1. `code/packages/server/src/bot/card-tracker.ts` — add `allRanksAboveAccountedFor(rank)`
2. `code/packages/server/src/bot/bot.ts` — update `evaluatePhoenixPlay()` PHX01, PHX02, PHX03/04
3. `code/packages/server/tests/bot/bot.test.ts` — add tests for cascading behavior
4. `code/packages/server/tests/bot/card-tracker.test.ts` — add test for new tracker method

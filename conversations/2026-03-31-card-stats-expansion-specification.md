# Card / Hand Stats Expansion — Specification Conversation

## Summary

**Goal:** Expand the Card Stats tab with detailed Phoenix play types, Dog control outcomes, bomb size distribution, conflicting bombs, over-bomb directions, comprehensive pass tracking matrix, and pass persistence on abandon.

**Key Decisions:**
- Phoenix play types detected via Combination.type + checking if Phoenix is in cards
- Dog control uses existing lastDogPlay.toSeat; self-control possible when partner + left opponent both out
- "Stuck with Dog as Last Card" = hand reduced to 1 card that is the Dog, regardless of outcome
- Conflicting bombs: 4-of-a-kind sharing cards with straight flush such that playing one breaks the other. Straight flush >5 cards does NOT self-conflict. Two 4-of-a-kinds vs one flush = 2 conflicts.
- Bomb sizes: 11 individual columns (4 through 14) replacing 3 grouped columns
- Over-bomb split: youOverBombed (attacker) + youWereOverBombed (victim)
- Pass bomb completion: card received that brings a rank count from 3 to 4 = bomb completed
- Pass stats tied to passing player, not seat replacement
- Pass stats saved on game abandon/restart after pass phase

**Requirements:** 26 FR (REQ-F-CS01–CS26), 3 NFR (REQ-NF-CS01–CS03)
**Confidence:** High
**Spec file:** specifications/2026-03-31-card-stats-expansion.md

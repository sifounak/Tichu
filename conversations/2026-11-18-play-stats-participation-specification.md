# Approved specification conversation

## Summary

User reported missing Phoenix usage/longest and bomb pass statistics and requested bot participation views. Read-only investigation found casing, Phoenix single detection, restricted inventory, missing card selection, relationship attribution and misleading labels. Existing cache tests: 44 passing with unrealistic Phoenix fixture.

## User decisions (verbatim answers)

- Mixed games: "2–3 humans (Recommended)"; later clarified "Yes, Mixed (Recommended)" when a second distinct human joins a solo game.
- Replacements: "Exclude whole game (Recommended)".
- Outcome: "Findings and plan (Recommended)".
- Fix scope: "All confirmed defects (Recommended)".
- Default: "All stats, human leaderboard".
- Bomb semantics: "If a player passes a card to an opponent and that card helps form a bomb (even if forming the bomb used a card received from another player, too), this counts for as passing a single bomb to an opponent. If a player forms a bomb using multiple cards they received, it only counts as 1 bomb received, not one for each person that passed a card that was used to form that bomb. However, if a passed card can be used to form multiple bombs, it should count for both bombs. However, let's limit the maximum number of bombs that can be formed by a single passed card to 2 (a single 4-of-a-kind bomb and a straight flush bomb of any length), and not count the permutations of varying the length of long straight flush bombs. Ask more clarifying questions about this so we get the logic right."
- Straight flush: "One longest run (Recommended)".
- Extensions: "Yes, credit extension (Recommended)".
- Received directions: "I wouldn't add a new category, but just individually credit each player involved in that pass." Confirmed overlapping existing direction rows and one distinct Total bombs received: "Yes (Recommended)".
- Autopilot: "Only actual bot seats".
- Longest straight: "General and Phoenix (Recommended)".
- Historical classification: "Infer and label (Recommended)".

## Execution approval

User: "Implement the approved plan."

The approved plan is serialized in the specification and implementation plan. Tool-visible conversation text is retained here without inventing inaccessible transcript content.

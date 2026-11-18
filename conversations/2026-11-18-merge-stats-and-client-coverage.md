# Merge preparation

User: "Let's merge the last 2 branches into main and push changes."

The client-unit-coverage branch includes all play-stats-participation commits and the previously unpushed local main description change. Both branches were pushed. Combined PR #26 targets main; squash merge follows repository policy and requires build-and-test.

First CI run passed build/lint/typecheck but exposed an existing randomized bot fixture: the reassessment test's random second lead could be unbeatable, leaving validPlays empty. The fixture now swaps known low/high cards into the lead/bot hands, preserving unique ownership and hand sizes, and explicitly leads the low card. Gameplay code and assertions remain intact.

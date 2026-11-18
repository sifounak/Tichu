# Play statistics

Phoenix use counts reflect played cards for single, pair, triple, full house, consecutive pairs and straight. Longest straight measures cards in an ordinary straight play; the Phoenix version requires Phoenix in that play. Clean and dirty Tichu achievements retain the existing 13-card straight definition.

Bomb passing counts each four-of-a-kind and each longest consecutive run of one suit (at least five cards) in the recipient's post-pass hand. A passed card contributes when it belongs to that bomb, including an extension. Shorter subsets of a long run do not add credits. One passed card can contribute to both a four-of-a-kind and a straight flush, for at most two credits.

Every contributing sender earns credit. Received partner/opponent counts can overlap; two opponent cards forming the same bomb count once in the opponent direction. Total bombs received counts distinct bombs once regardless of contributor count.

Relationship statistics count shared rounds, with one game per relationship; round achievements and team bombs are restricted to those shared rounds. Game wins retain final-occupant credit. Double Bomb counts two bomb plays, even by one seat. Blind Grand broken calls are distinct from Grand and ordinary Tichu.

## Participation views

All games includes all eligible records. Human-only excludes an entire game if an actual bot occupied any seat, even briefly. Humans and bots means at least two distinct humans and a bot participated. Solo means exactly one human participated alongside bots. A second human joining a solo game changes it to Humans and bots. Human-owned autopilot and timeout automation do not change these categories.

Personal statistics default to All games; the leaderboard defaults to Human-only. API callers can supply `participation=all|human-only|mixed|solo` on profile, relationships, game history and leaderboard endpoints. Omitted parameters preserve All-game behavior. Responses include `metadata` with the selected view and total/inferred game counts; history records include classification and whether it was inferred.

New games persist participant identities and sticky bot participation from the beginning and through replacements. Older records are inferred from stored participants and final occupants; they cannot prove that no brief mid-round replacement occurred. Filtered displays identify inferred historical coverage. Restart snapshots and recovery event data preserve participation; new recorded bot rounds are excluded from the legacy user-ID backfill.

## Migration and cache repair

Startup adds participation/stat columns and changes disposable caches to user/view keys while preserving existing All-game rows. Calculation version 2 refreshes corrected statistics, with completed-round and participation changes tracked by source revision. The admin `rebuild-stats` command rebuilds all four views; user count remains distinct users, while cache row count reflects the views. No history is deleted. Cached final results remain completion-dependent, and finished rounds in ongoing games still contribute round statistics.

Game completion and progress updates advance the source revision even when their timestamps match the cache's second. This lets on-demand refresh recover a missed incremental update. History includes replaced participants, uses their recorded seat for team-relative scores, and shows a forfeit when they were not final occupants.

## Verification notes

Final tests: 1,094 server, 440 shared and 383 client tests pass. Type checks pass for every package. New bomb-pass, participation classification, and client selector/request modules have 100% statement coverage; modified source passes ESLint with TypeScript handling global-name checking.

The client now declares Node 24 type definitions so a cold Next.js build can type-check without auto-installing an undeclared dependency. On this Windows workstation, ordinary standalone packaging fails because directory symlink creation lacks permission. Production compilation, static generation and standalone packaging were verified using the local junction preload archived in `results/play-stats-participation/Milestone3/verify-junctions.mjs`; application configuration is unchanged. Build lint was run separately because the repository does not declare/install its ESLint tooling.

The existing client-wide coverage gate remains below 80%: baseline 65.42%, repaired implementation 70.59%. All client tests pass, and new/modified filter-navigation components meet 100% statement coverage. This existing coverage deficit is recorded rather than changing the threshold or adding unrelated tests.

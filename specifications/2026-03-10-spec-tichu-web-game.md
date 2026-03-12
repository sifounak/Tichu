# Specification: Tichu Web Card Game

**Version:** 1.0
**Date:** 2026-03-10
**Status:** Draft
**Confidence:** High — All requirements elicited through detailed Q&A, rules well-understood, tech stack confirmed, edge cases enumerated

## 1. Goal

Build a web-based, real-time multiplayer Tichu card game with a gorgeous, modern UI. The game supports any combination of human and bot players (0-4 humans), room-based matchmaking with a public lobby, guest and registered accounts, and responsive play on desktop and mobile devices.

**Why:** Provide an accessible, visually polished way to play Tichu online with friends or bots, without requiring app installation.

## 2. Context & Background

Tichu is a 4-player partnership trick-taking card game using a 56-card deck (standard 52 + Dragon, Phoenix, Mahjong, Dog). Players sit in fixed partnerships (North/South vs East/West) and play combinations of cards to empty their hands. The game has deep strategy involving Tichu declarations, card passing, and special card interactions.

No existing codebase — this is a greenfield project.

**Tech stack (confirmed):**
- Frontend: React + Next.js (App Router), Tailwind CSS + CSS Modules, Framer Motion, @dnd-kit, Zustand
- Backend: Node.js + TypeScript + Fastify, ws library, XState v5
- Database: PostgreSQL + Drizzle ORM
- Shared: Zod validation, pure TS game engine in monorepo
- Build: Turborepo, pnpm workspaces, Docker Compose
- i18n: next-intl (English first, i18n-ready)

## 3. Requirements

### 3.1 Functional Requirements — Card & Deck

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-C01 | 56-card deck: 4 suits × 13 ranks (2-Ace) + Dragon, Phoenix, Mahjong, Dog | Must | All 56 unique cards created with stable IDs |
| REQ-F-C02 | Fisher-Yates shuffle for fair randomization | Must | Shuffle produces uniform distribution (no duplicates, all cards present) |
| REQ-F-C03 | Deal 8 cards to each player initially, then 6 remaining after Grand Tichu decision | Must | Each player receives exactly 14 cards, no duplicates across players |
| REQ-F-C04 | Card point values: Kings=10, Tens=10, Fives=5, Dragon=25, Phoenix=-25, others=0 | Must | `getCardPoints()` returns correct value for all 56 cards |

### 3.2 Functional Requirements — Combinations

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-CB01 | Detect all valid combination types: Single, Pair, Triple, Full House, Straight (5+), Pair Sequence (2+ consecutive pairs), Four-of-a-Kind Bomb, Straight Flush Bomb | Must | `detectCombination()` correctly identifies all types from any valid card set |
| REQ-F-CB02 | Combination comparison: same type + same length + higher rank beats; bombs beat all non-bombs; straight-flush bomb beats four-of-a-kind bomb | Must | `canBeat()` returns correct result for all comparison cases |
| REQ-F-CB03 | Dragon is only playable as a Single (highest single in the game) | Must | Dragon in any multi-card combination returns invalid |
| REQ-F-CB04 | Dog is only playable as a lead (no current trick); passes lead to partner | Must | Dog on existing trick returns invalid; Dog as non-lead returns invalid |
| REQ-F-CB05 | Mahjong counts as rank 1 in straights; valid as a single | Must | Mahjong integrates correctly in straights starting from 1 |
| REQ-F-CB06 | Enumerate all valid plays from a hand given current trick and wish | Must | `getValidPlays()` returns complete set of legal plays |

### 3.3 Functional Requirements — Phoenix

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-PH01 | Phoenix NEVER forms a bomb (four-of-a-kind or straight flush) | Must | Any card set where Phoenix would create a bomb returns invalid |
| REQ-F-PH02 | Phoenix NEVER acts as Dragon, Dog, or Mahjong | Must | Phoenix cannot substitute for any special card |
| REQ-F-PH03 | Phoenix value cannot equal or be lower than Mahjong (rank 1); minimum Phoenix rank in combinations is 2 | Must | Phoenix value resolution never produces value ≤ 1 in combinations |
| REQ-F-PH04 | Leading single Phoenix always has value 1.5 | Must | Phoenix played first in a trick (no existing cards) = 1.5 |
| REQ-F-PH05 | Phoenix played as single on existing trick = current leader rank + 0.5 | Must | Auto-calculated, no user prompt |
| REQ-F-PH06 | Auto-determine Phoenix value when only one valid value exists (pair, triple, full house 3+1, straight with one gap, straight starting with non-Phoenix 2) | Must | No prompt shown; value auto-resolved |
| REQ-F-PH07 | When multiple valid Phoenix values exist, present ONLY the valid options to the user (e.g., full house 2+2, open-ended straight) | Must | Picker shows exactly the valid values, nothing else |
| REQ-F-PH08 | Phoenix in a straight starting with non-Phoenix 2: only the high end is valid (can't go below 2) | Must | Auto-resolve to high end value |

### 3.4 Functional Requirements — Game Flow

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-GF01 | Game lifecycle: Deal 8 → Grand Tichu decision → Deal 6 → Regular Tichu decision → Card passing → Play → Score → Repeat until target score | Must | State machine transitions through all phases correctly |
| REQ-F-GF02 | Card passing: each player passes 1 card to each other player (3 cards total) | Must | All players pass simultaneously; cards exchanged correctly |
| REQ-F-GF03 | Mahjong holder leads first trick; can declare a wish for a rank | Must | First lead enforced; wish UI shown |
| REQ-F-GF04 | Mahjong wish: subsequent players must play the wished rank if they can (in a valid combination that beats the current trick) | Must | `mustFulfillWish()` correctly enforces; wish tracked until fulfilled or impossible |
| REQ-F-GF05 | Trick won by 3 consecutive passes after the last play | Must | Pass counter tracked; trick awarded to last player |
| REQ-F-GF06 | Round ends when ≤1 player has cards remaining | Must | Correct finish order tracking; triggers scoring |
| REQ-F-GF07 | Turn order skips players who have gone out | Must | Next active player correctly determined |
| REQ-F-GF08 | Tichu declaration: +100/-100 bonus/penalty; available before player's first play in a round | Must | Call tracked; bonus applied in scoring |
| REQ-F-GF09 | Grand Tichu declaration: +200/-200 bonus/penalty; available after seeing first 8 cards only | Must | Call window enforced; bonus applied in scoring |
| REQ-F-GF10 | Customizable target score (default 1000) | Must | Game ends when a team reaches/exceeds target |

### 3.5 Functional Requirements — Dragon & Scoring

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-DR01 | Dragon wins trick as single → trick must be given to an opponent | Must | Dragon gift prompt shown |
| REQ-F-DR02 | If one opponent has already gone out, auto-give Dragon trick to remaining opponent (skip prompt) | Must | No prompt when only 1 opponent active |
| REQ-F-DR03 | Bomb winning a trick containing Dragon: winner keeps trick (no gift) | Must | No Dragon gift prompt when bomb wins |
| REQ-F-SC01 | Standard scoring: card points per team, Tichu/Grand Tichu bonuses | Must | `scoreRound()` produces correct totals |
| REQ-F-SC02 | 1-2 finish: if both partners finish first and second, their team gets all 100 card points | Must | Opponent card points = 0 in 1-2 finish |
| REQ-F-SC03 | Last player: remaining hand points to opponents; tricks to first-out player | Must | Correct redistribution |

### 3.6 Functional Requirements — Hand Validation & UX

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-HV01 | Progressive card filtering: grey out cards that cannot form a valid combination with current selection | Must | Cards update on each selection change; only valid extensions remain selectable |
| REQ-F-HV02 | Dragon/Dog selected → all other cards disabled (solo-only cards) | Must | UI immediately disables all others |
| REQ-F-HV03 | Dog disabled when trick is active (can only lead) | Must | Dog greyed out when not leading |
| REQ-F-HV04 | Phoenix disabled if adding it would form a bomb | Must | Phoenix greyed when 3 of same rank selected |
| REQ-F-HV05 | Prefix matching: don't grey out cards that could be part of a valid combo not yet fully selected | Must | Partial selection doesn't over-restrict |
| REQ-F-HV06 | Prevent all invalid plays through UI (no error-after-submit approach) | Must | Play button only enabled for valid combinations |
| REQ-F-HV07 | Click-to-select card interaction (toggle selection, visual lift) | Must | Cards lift 12px with gold shadow when selected |
| REQ-F-HV08 | Drag-and-drop card interaction via @dnd-kit | Must | Drag selected cards to trick area; accessible keyboard support |
| REQ-F-HV09 | Greyed-out cards: 0.4 opacity + diagonal pattern, ignore click events | Must | Visual distinction clear; not clickable |

### 3.7 Functional Requirements — Multiplayer & Rooms

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-MP01 | Any combination of 0-4 human players; bot fills remaining seats | Must | 1 human + 3 bots, 2+2, 3+1, 4+0 all work |
| REQ-F-MP02 | Room codes: create room, get shareable 6-char code/link | Must | Unique codes generated; join by code works |
| REQ-F-MP03 | Public lobby: browse open rooms, see seat availability, join | Must | Room list updates in real-time |
| REQ-F-MP04 | Room configuration: target score, bot difficulty, animation speed, spectators on/off, private/public, turn timer | Must | All settings applied to game |
| REQ-F-MP05 | Fixed seats: North/South vs East/West partnerships; host can rearrange before start | Must | Seat assignment visible; rearrangement works |
| REQ-F-MP06 | Spectator mode: watch a game in progress (read-only, no hands visible) | Should | Spectators see public game state |
| REQ-F-MP07 | In-game text chat between players | Should | Messages delivered to all room members |
| REQ-F-MP08 | Disconnect handling: remaining players vote (wait / replace with bot / abandon) | Must | Vote UI shown; majority decision applied |
| REQ-F-MP09 | Turn timer: optional, configurable; auto-pass on timeout | Should | Timer displayed; auto-pass fires correctly |

### 3.8 Functional Requirements — Bots

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-BOT01 | Bot strategy interface: pluggable difficulty levels | Must | Interface defined; strategies swappable |
| REQ-F-BOT02 | EasyBot: random valid plays, never calls Tichu | Must | Makes only valid moves; game completes |
| REQ-F-BOT03 | MediumBot: heuristic-based (lead low, save bombs, hand evaluation for Tichu calls) | Should | Plays measurably better than EasyBot |
| REQ-F-BOT04 | HardBot: card tracking, probability estimation, game-score-aware | Could | Future enhancement; interface ready |
| REQ-F-BOT05 | Artificial thinking delay (200-1500ms) for natural feel | Must | Delay configurable with animation speed |

### 3.9 Functional Requirements — Auth & Persistence

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-AU01 | Guest access: play immediately with display name, no registration | Must | Guest can create/join room and play |
| REQ-F-AU02 | Optional account: register with email/password to track stats | Should | Account creation, login, logout work |
| REQ-F-AU03 | Game history: completed games stored in database | Should | Past games viewable in profile |
| REQ-F-AU04 | Leaderboard: top players by win rate (minimum games threshold) | Should | Leaderboard page with correct rankings |

### 3.10 Functional Requirements — Display

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-DI01 | Show cards remaining per player | Must | Card count visible for all seats |
| REQ-F-DI02 | Show current trick leader and current player | Must | Visual highlight on active/winning seat |
| REQ-F-DI03 | Show whether each player has passed in current trick | Must | Pass indicator visible |
| REQ-F-DI04 | Show Tichu/Grand Tichu call indicators | Must | Call badge visible on player seat |
| REQ-F-DI05 | Current score with expandable score history | Must | Collapsed score; tap to see per-round breakdown |
| REQ-F-DI06 | Current leading trick displayed in center | Must | Cards visible in trick area |
| REQ-F-DI07 | Mahjong wish indicator (rank wished, who must fulfill) | Must | Prominent display when wish active |

### 3.11 Non-Functional Requirements

| ID | Requirement | Category | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-NF-P01 | Hand filtering completes in < 1ms for a 14-card hand | Performance | Benchmark test passes |
| REQ-NF-P02 | Card animations at 60fps using transform/opacity only | Performance | No layout-triggering animations; Lighthouse performance audit |
| REQ-NF-P03 | WebSocket latency < 100ms for local play | Performance | Measured round-trip time |
| REQ-NF-U01 | Responsive: works on desktop (>1024px) and mobile (<640px) | Usability | Visual tests at both breakpoints |
| REQ-NF-U02 | Animations: configurable speed (slow/normal/fast/off); respects prefers-reduced-motion | Usability | Animation toggle works; OS setting respected |
| REQ-NF-U03 | Keyboard navigation: roving tabindex on cards, tab order, Enter to play | Accessibility | Full game playable via keyboard |
| REQ-NF-U04 | Screen reader support: aria-labels on cards, aria-live regions for game events | Accessibility | Screen reader can follow game state |
| REQ-NF-U05 | Color contrast: WCAG AA (4.5:1 minimum); suit distinction by symbol, not just color | Accessibility | Contrast audit passes |
| REQ-NF-U06 | Touch targets: minimum 44×44px on mobile | Usability | All interactive elements meet minimum |
| REQ-NF-A01 | Monorepo: shared game logic package used by both client and server | Architecture | Same pure TS code runs on both sides |
| REQ-NF-A02 | Server is authoritative: clients receive projected state only (own hand + public info) | Security | No other player's hands in client state |
| REQ-NF-A03 | All WebSocket messages validated with Zod schemas | Security | Invalid messages rejected with error |
| REQ-NF-A04 | i18n-ready: all strings through next-intl, CSS logical properties | Maintainability | Adding a language = adding a JSON file |
| REQ-NF-D01 | Local-first: `docker-compose up` starts full stack | Deployment | Single command starts client + server + DB |
| REQ-NF-D02 | Cloud-deployable: Docker Compose maps to container orchestration | Deployment | No local-only dependencies |
| REQ-NF-T01 | 80%+ statement coverage for new code | Testing | Coverage reports verify threshold |
| REQ-NF-T02 | 100% coverage for shared game engine (milestones 2-6) | Testing | Coverage reports verify 100% |

### 3.3 Constraints

- **Platform:** Modern browsers (Chrome, Firefox, Safari, Edge); no IE11 support required
- **Language:** TypeScript for all packages
- **Runtime:** Node.js 20+ for server
- **Database:** PostgreSQL 16
- **Package manager:** pnpm with workspaces
- **Build:** Turborepo for monorepo orchestration
- **Test runner:** Vitest (unit/integration), Playwright (E2E)

### 3.4 Assumptions

- Users have a modern browser with WebSocket support (critical — WebSocket is the only real-time transport)
- Docker is available for local development (fallback: run services individually)
- pnpm is installed globally (or npx can bootstrap it)
- PostgreSQL can run locally via Docker container
- The standard Tichu rule set is well-defined and not ambiguous (using the widely accepted international rules)

## 4. Scope

### 4.1 In Scope

- Standard 4-player Tichu game with all rules
- Real-time multiplayer via WebSocket
- Bot opponents (easy, medium difficulty)
- Room-based matchmaking with public lobby
- Guest and optional registered accounts
- Game history and leaderboards
- Responsive desktop and mobile UI
- Card animations (configurable speed)
- Progressive card filtering and Phoenix value resolution
- In-game chat
- Spectator mode
- Disconnect handling with vote
- Docker Compose deployment

### 4.2 Out of Scope

- **React Native mobile app** — future consideration; architecture designed for portability
- **Game replay/review** — future; events stored in DB for later implementation
- **HardBot AI** — interface ready, but advanced strategy deferred
- **Non-English languages** — i18n infrastructure in place; translations deferred
- **Cloud deployment configuration** — Docker Compose only; no Kubernetes/Terraform
- **Sound effects** — may add in polish phase but not required
- **Tournament mode** — not in scope
- **2-player or 6-player variants** — 4-player only

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|---------|------------------|
| EC-001 | Phoenix played as leading single | Value = 1.5 (beats Mahjong 1, loses to any standard card 2+) |
| EC-002 | Phoenix + 3 same-rank cards selected | Phoenix disabled (would form bomb); only 3-of-a-kind valid |
| EC-003 | Phoenix in same-suit consecutive cards | Invalid if would form straight flush bomb |
| EC-004 | Dragon wins trick, one opponent already out | Auto-give to remaining opponent (skip prompt) |
| EC-005 | Bomb wins trick containing Dragon | Winner keeps trick; no Dragon gift |
| EC-006 | Mahjong wish: player has wished rank but can't beat current trick | Player can pass (wish not enforceable) |
| EC-007 | Straight starting with non-Phoenix 2 + Phoenix | Phoenix can only be high end (auto-resolve) |
| EC-008 | Full house with 2+2+Phoenix | Prompt with both pair ranks as options |
| EC-009 | Player disconnects mid-trick | Other players vote: wait/bot/abandon |
| EC-010 | All 4 players are bots | Game runs to completion server-side (useful for testing) |
| EC-011 | Player has only Dog and it's not their lead | Player must pass (Dog unplayable) |
| EC-012 | Mahjong played in a straight: wish still applies | Wish declared after straight played with Mahjong |
| EC-013 | Both teams reach target score in same round | Team with higher score wins; if tied, play another round |
| EC-014 | 1-2 finish: both partners go out 1st and 2nd | 200 points to winning team, 0 card points to opponents |
| EC-015 | Phoenix in pair sequence with gap | Phoenix fills the incomplete pair (auto-resolve) |
| EC-016 | Player calls Tichu but finishes last | -100 penalty applied |
| EC-017 | Straight with Mahjong + Phoenix: Phoenix can't be Mahjong | Phoenix must be rank ≥ 2; auto-resolve to gap or high end |
| EC-018 | Dog played when partner has already gone out | Lead passes to next player in turn order (clockwise from partner) |

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | Combination detection complexity: edge cases with Phoenix in various combination types | Medium | High | Exhaustive unit tests (100% coverage); truth table for all Phoenix scenarios |
| R-002 | Animation jank: multiple concurrent card animations causing frame drops | Medium | Medium | Animation queue processes events serially; GPU-only properties (transform, opacity) |
| R-003 | WebSocket reconnection: player rejoins mid-trick with stale state | Medium | High | Full GAME_STATE sync on reconnect; server is authoritative |
| R-004 | Mobile card selection: 14 cards in narrow viewport | Medium | Medium | Horizontal scroll with momentum; overlap tuning; zoom mode |
| R-005 | Progressive filtering performance: recalculating valid plays on every selection change | Low | Medium | Precompute valid plays on hand change, filter on selection change; < 1ms target |
| R-006 | State machine complexity: many phases and transitions, risk of invalid state | Medium | High | XState v5 with strict typing; comprehensive integration tests |
| R-007 | Bot infinite loop: bot can't find valid play, loops forever | Low | Critical | Timeout on bot decision; fallback to pass; smoke test 100+ games |

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Game engine correctness | 100% unit test pass rate for shared package | Vitest test suite |
| Code coverage (shared) | 100% statement coverage | Vitest coverage report |
| Code coverage (server/client) | ≥ 80% statement coverage | Vitest coverage report |
| Bot reliability | 100 consecutive 4-bot games without errors | Automated smoke test |
| Animation performance | 60fps during card play | Lighthouse performance audit; manual observation |
| Hand filter speed | < 1ms for 14-card hand | Benchmark test |
| Responsive layout | Functional at 640px and 1024px | Visual test at breakpoints |
| Accessibility | Lighthouse accessibility score ≥ 90 | Lighthouse audit |
| WebSocket latency | < 100ms round-trip (local) | Network timing measurement |
| Full game E2E | Lobby → room → game → scoring → game over | Playwright E2E test |

## 8. Open Questions

None — all requirements have been elicited and confirmed through detailed Q&A.

## 9. Glossary

| Term | Definition |
|------|-----------|
| **Tichu** | A 4-player partnership trick-taking card game |
| **Trick** | A sequence of plays in which each player plays a combination or passes; won by the last player to play |
| **Combination** | A valid set of cards played together (single, pair, triple, straight, etc.) |
| **Bomb** | Four-of-a-kind or straight flush; can be played out of turn and beats any non-bomb |
| **Dragon** | Special card; highest single (rank 25); trick must be given to an opponent |
| **Phoenix** | Special wild card; +0.5 as single; substitutes in combinations (never bombs, never other specials) |
| **Mahjong** | Special card; rank 1; holder leads first trick and may declare a wish |
| **Dog** | Special card; passes lead to partner; can only be played as a lead |
| **Wish** | When Mahjong is played, the player may name a rank; subsequent players must play that rank if possible |
| **Grand Tichu** | Declaration made after seeing first 8 cards; +200/-200 bonus/penalty |
| **Tichu** | Declaration made before first play; +100/-100 bonus/penalty |
| **Seat** | Fixed position at the table: North, East, South, West |
| **1-2 Finish** | Both partners go out first and second; team scores all 100 card points |
| **Progressive filtering** | UI pattern where unplayable cards are greyed out as the player builds a selection |

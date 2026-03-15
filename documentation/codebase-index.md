# Tichu Web Game — Codebase Index

## Tech Stack & Infrastructure

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict, ES2022, ESM) |
| Frontend | Next.js 15 (App Router), React 19, Zustand 5, Framer Motion 12 |
| Backend | Fastify 5, ws (WebSocket), XState 5 (state machine) |
| Database | PostgreSQL via Drizzle ORM + postgres.js |
| Auth | bcryptjs + JWT (7-day expiry) |
| Validation | Zod (all WebSocket messages) |
| Testing | Vitest 3 + @testing-library/react |
| Style | CSS Modules + CSS custom properties (design tokens in globals.css) |
| Formatting | Prettier (single quotes, trailing commas, 100 width) |

## Repository Structure

```
c:/MATLAB/Claude/Tichu/
├── code/
│   ├── packages/
│   │   ├── shared/          # Pure game engine + types (zero UI/server deps)
│   │   ├── client/          # Next.js frontend (port 3000)
│   │   └── server/          # Node.js backend + WebSocket (port 3001)
│   ├── package.json         # Root workspace
│   ├── pnpm-workspace.yaml
│   ├── tsconfig.base.json   # Shared compiler options
│   ├── turbo.json           # Build orchestration
│   ├── eslint.config.js
│   ├── .prettierrc
│   ├── docker-compose.yml   # PostgreSQL for local dev
│   └── dev-start.sh         # Kill ports → build → start server + client
├── documentation/           # Feature docs
├── specifications/          # Specs + RTMs
├── conversations/           # Transcript history
├── results/                 # Milestone artifacts
└── CLAUDE.md                # Project rules (mandates /diligent-developer)
```

---

## Package: @tichu/shared

**Path:** `code/packages/shared/src/`

Pure game engine and type definitions. Only runtime dependency is Zod.

### Types (`types/`)

| File | Key Exports |
|------|-------------|
| `card.ts` | `Suit`, `Rank`, `SpecialCardType`, `Card` (discriminated union: StandardCard, DragonCard, PhoenixCard, MahjongCard, DogCard), `GameCard` {id, card}, type guards (`isStandard`, `isDragon`, etc.) |
| `combination.ts` | `CombinationType` (Single, Pair, Triple, FullHouse, Straight, PairSequence, FourBomb, StraightFlushBomb), `Combination` {type, cards, rank, length, phoenixUsedAs?, isBomb} |
| `game.ts` | `Seat` (north/east/south/west), `Team` (northSouth/eastWest), `GamePhase` enum, `TichuCall`, `PlayerState`, `TrickState`, `RoundState`, `GameState`, `ClientGameView` (projected per-player), `GameConfig`, `RoundScore`, helpers (`getTeam`, `getPartner`, `getNextSeat`) |
| `protocol.ts` | `ClientMessage` (22 types), `ServerMessage` (20+ types), Zod schemas for all messages |
| `room.ts` | `RoomPlayer`, `RoomConfig`, `Room`, `LobbyEntry` |

### Engine (`engine/`)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `deck.ts` | `createDeck()`, `shuffleDeck()`, `dealCards()` | 56-card deck creation, Fisher-Yates shuffle, deal 8+6 per seat |
| `combination-detector.ts` | `detectCombination(cards)` | Identify combination type from card set |
| `combination-validator.ts` | `canBeat(play, trick)` | Validate play beats current trick |
| `combination-utils.ts` | Various combo helpers | Comparison, ranking utilities |
| `hand-filter.ts` | `getSelectableCards()`, `canPlayerPass()` | Filter playable cards for UI |
| `phoenix-resolver.ts` | Phoenix substitution logic | Resolve Phoenix rank in combinations |
| `scoring.ts` | `scoreRound()`, `checkGameOver()`, `getCardsPoints()` | Round scoring (card points + tichu bonuses + 1-2 bonus) |
| `rules.ts` | Play validation rules | Turn legality, wish fulfillment |
| `wish.ts` | Mahjong wish logic | Declaration and fulfillment tracking |

### Constants (`constants.ts`)

Card points (K/10=10, 5=5, Dragon=25, Phoenix=-25), deck size (56), deal sizes (8+6=14), rank ordering.

---

## Package: @tichu/server

**Path:** `code/packages/server/src/`

### Entry & Setup

| File | Purpose |
|------|---------|
| `index.ts` | Entry point — calls `createApp().start()` |
| `app.ts` | Creates Fastify + WebSocket server. Health endpoint `/health`. WebSocket upgrade at `/ws?userId=&playerName=`. Registers ConnectionManager, Broadcaster, MessageRouter, RoomHandler, GameHandler. Stale connection cleanup. Graceful shutdown. |

### WebSocket Layer (`ws/`)

| File | Key Class/Function | Purpose |
|------|-------------------|---------|
| `connection-manager.ts` | `ConnectionManager` | Track clients (userId, seat, room, lastPong). Heartbeat ping/pong (30s interval, 45s stale). Methods: `addClient`, `removeClient`, `assignToRoom`, `getClientsInRoom`, `getClientBySeat`. |
| `broadcaster.ts` | `Broadcaster` | Send messages: `send(ws)`, `sendToPlayer(room, seat)`, `broadcastToRoom(room)`, `broadcastGameState(room)` (projects per-player view via `projectGameState`). |
| `message-router.ts` | `MessageRouter` | Zod-validate incoming JSON, route by message type to registered handlers. |
| `state-projection.ts` | `projectGameState()` | Convert full game context → `ClientGameView` (hides opponent hands). Maps XState states → GamePhase. |

### Room Management (`room/`)

| File | Key Class | Purpose |
|------|----------|---------|
| `room-manager.ts` | `RoomManager` | CRUD rooms, assign seats, add/remove bots, swap seats, track disconnections, periodic cleanup (30 min). Room codes: 6-char alphanumeric. |
| `room-handler.ts` | `RoomHandler` | WebSocket handlers for CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM, CONFIGURE_ROOM, ADD_BOT, REMOVE_BOT, SWAP_SEATS, GET_LOBBY, START_GAME. Host-only validation. Broadcasts ROOM_UPDATE. |

### Game Logic (`game/`)

| File | Key Class/Function | Purpose |
|------|-------------------|---------|
| `game-state-machine.ts` | `gameMachine`, `createGameActor()` | XState 5 state machine. States: lobby → grandTichuDecision → regularTichuDecision → cardPassing → playing → awaitingDragonGift → roundScoring → gameOver. All game rules encoded as guards/actions. |
| `game-store.ts` | `GameStore` | In-memory store of active `GameManager` instances, indexed by gameId and roomCode. |
| `game-manager.ts` | `GameManager` | Orchestrates single game: holds XState actor + TurnTimer + MoveHandler + BotRunner. Routes messages, handles disconnect/reconnect, broadcasts state on transitions. |
| `game-handler.ts` | `GameHandler` | Routes game WebSocket messages (PLAY_CARDS, PASS_TURN, GRAND_TICHU_DECISION, etc.) from client → GameManager. |
| `move-handler.ts` | `MoveHandler` | Translates client messages → XState events. Validates preconditions (correct turn, cards in hand, etc.). Returns `MoveResult` {ok} or {ok: false, error}. |
| `turn-timer.ts` | `TurnTimer` | Optional countdown per turn, auto-pass on timeout. |
| `disconnect-handler.ts` | `DisconnectHandler` | Disconnect detection → vote session (wait/bot/abandon) → 60s timeout defaults to bot replacement. 2/3 majority threshold. |

### Bot AI (`bot/`)

| File | Key Class | Purpose |
|------|----------|---------|
| `bot-interface.ts` | `BotStrategy` interface | Methods: `chooseGrandTichu`, `chooseRegularTichu`, `chooseCardsToPass`, `choosePlay`, `chooseDragonGiftRecipient`, `chooseMahjongWish`. Difficulty: easy/medium/hard. |
| `easy-bot.ts` | `EasyBot` | Random-move bot. Always passes tichu. 30% pass chance. |
| `bot-runner.ts` | `BotRunner` | Manages bot instances per game. Triggers auto-play on state changes with artificial delay (800-1500ms). |

### Auth (`auth/`)

| File | Purpose |
|------|---------|
| `guest.ts` | `ensureGuestUser()`, `getUserById()` — guest sessions |
| `account.ts` | `registerAccount()`, `loginAccount()`, `verifyToken()` — bcrypt + JWT |
| `auth-routes.ts` | HTTP routes: POST `/api/auth/guest`, `/register`, `/login`; GET `/api/auth/me`, `/api/players/:userId/profile`, `/api/players/:userId/games`, `/api/games/:gameId/rounds`, `/api/leaderboard`, `/api/games/recent` |

### Database (`db/`)

| File | Purpose |
|------|---------|
| `connection.ts` | `createDatabase()` — Drizzle ORM + postgres.js pool (max 10) |
| `schema.ts` | Tables: `users`, `games`, `gameRounds`, `playerStats` |
| `game-persistence.ts` | `saveGameResult()` — transactional save game + rounds + update stats |
| `queries.ts` | Read queries: leaderboard, player profile, game history, recent games |

---

## Package: @tichu/client

**Path:** `code/packages/client/src/`

### Pages (Next.js App Router: `app/`)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Landing — Play / Sign In / Leaderboard links |
| `/auth` | `auth/page.tsx` | Login / Register / Guest init |
| `/lobby` | `lobby/page.tsx` | Browse public rooms, create, join by code. Polls GET_LOBBY every 2s. |
| `/lobby/[roomId]` | `lobby/[roomId]/page.tsx` | Room waiting area — seat layout (D-pad), bot controls, config, start game. Auto-joins on mount. |
| `/game/[gameId]` | `game/[gameId]/page.tsx` | Main game view — GameTable + ActionBar + CardHand + overlays |
| `/spectate/[gameId]` | `spectate/[gameId]/page.tsx` | Read-only spectator mode |
| `/leaderboard` | `leaderboard/page.tsx` | Top players by win rate (min 5 games) |
| `/profile` | `profile/page.tsx` | Player stats + game history |

### Zustand Stores (`stores/`)

| Store | Key State | Purpose |
|-------|-----------|---------|
| `gameStore.ts` | gameId, phase, scores, mySeat, myHand, otherPlayers, currentTrick, currentTurn, mahjongWish, dragonGiftPending, roundHistory, gameOverInfo | Authoritative game state from server. `applyGameState(view)` for full sync, `applyServerMessage(msg)` for incremental updates. |
| `uiStore.ts` | selectedCardIds, phoenixPickerOptions, connectionStatus, animationSpeed, chatMessages, chatOpen, chatUnread, disconnectedSeat, disconnectVoteRequired, tichuEvent, errorToast | Client-only UI state. Card selection, chat, animations, disconnect overlay. |
| `roomStore.ts` | roomCode, mySeat, players, hostSeat, config, gameInProgress, lobbyRooms | Room membership and lobby browsing. |
| `authStore.ts` | user, token, loading, error | Guest/account auth. Methods: initGuest, register, login, logout, loadFromStorage. |

### Hooks (`hooks/`)

| Hook | Purpose |
|------|---------|
| `useWebSocket.ts` | WebSocket connection with Zod validation, exponential backoff reconnection (500ms base, 15s max, 10 retries). Returns: status, send(), disconnect(). |
| `useCardSelection.ts` | Card filtering & validation. Returns: selectedIds, selectableIds, disabledIds, canPlay, canPass, isBombSelection, phoenixResolution, toggleCard(), clearSelection(). Uses shared engine functions. |
| `useAnimationSettings.ts` | Duration multipliers by speed setting (slow 1.5x, normal 1x, fast 0.5x, off 0). Respects prefers-reduced-motion. |
| `useRovingTabIndex.ts` | Keyboard navigation (Arrow keys, Home/End) for card hand. |

### Components (`components/`)

#### Game (`game/`)

| Component | Purpose |
|-----------|---------|
| `GameTable.tsx` | 3-seat grid (partner top, opponents left/right) + TrickDisplay center. Calculates seat positions relative to mySeat. |
| `PlayerSeat.tsx` | Player info: name, avatar/initial, card count, tichu badge, finish order, turn indicator. |
| `TrickDisplay.tsx` | Center trick area with Framer Motion card animations, bomb flash effect, wish indicator. |
| `ActionBar.tsx` | Pass / Play buttons + Tichu call. Layout: Pass | PlayerSeat | Play. Shake animation on invalid play. |
| `ScorePanel.tsx` | Score display (top-right), team-relative layout, Tichu badges (T/GT), expandable round history. |
| `ChatPanel.tsx` | Side chat panel with toggle button and unread badge. |
| `TichuBanner.tsx` | Full-screen Tichu call announcement animation. |
| `DisconnectOverlay.tsx` | Disconnect notification + vote UI (Wait/Bot/Abandon) with countdown. |
| `DragonGiftModal.tsx` | Choose opponent for dragon trick gift. |
| `AnimatedScore.tsx` | Number tally count-up animation. |

#### Cards (`cards/`)

| Component | Purpose |
|-----------|---------|
| `Card.tsx` | Single card (face/back). States: normal, selected, disabled, faceDown. |
| `CardHand.tsx` | Fan layout with selection, staggered deal animation, sorted by cardSortKey, roving tabindex. |
| `PhoenixValuePicker.tsx` | Modal grid to choose Phoenix rank (2-A). |
| `card-utils.ts` | SUIT_SYMBOLS, RANK_LABELS, suitColor(), cardSortKey(), cardAriaLabel(). |

#### Phases (`phases/`)

| Component | Purpose |
|-----------|---------|
| `PreGamePhase.tsx` | Grand Tichu (Yes/No), Regular Tichu (call/skip), Card Passing (3 slots). |
| `RoundEndPhase.tsx` | Round scoring overlay: card points, tichu bonuses, 1-2 bonus, totals. |
| `GameEndPhase.tsx` | Game over screen: winner, final scores, play again button. |

#### UI (`ui/`)

| Component | Purpose |
|-----------|---------|
| `ConnectionStatus.tsx` | Status badge (connecting/connected/disconnected/reconnecting). |
| `ErrorToast.tsx` | Auto-dismiss toast (3s). |

---

## WebSocket Protocol Summary

### Client → Server

**Room:** CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM, CONFIGURE_ROOM, ADD_BOT, REMOVE_BOT, SWAP_SEATS, GET_LOBBY, START_GAME

**Game:** GRAND_TICHU_DECISION, TICHU_DECLARATION, REGULAR_TICHU_PASS, PASS_CARDS, PLAY_CARDS, PASS_TURN, DECLARE_WISH, GIFT_DRAGON, DISCONNECT_VOTE, CHAT_MESSAGE

### Server → Client

**Room:** ROOM_CREATED, ROOM_JOINED, ROOM_UPDATE, ROOM_LEFT, LOBBY_LIST

**Game:** GAME_STATE (full sync), DEAL_FIRST_8, DEAL_REMAINING_6, CARDS_PLAYED, PLAYER_PASSED, TRICK_WON, TURN_CHANGE, WISH_DECLARED, WISH_FULFILLED, DRAGON_GIFT_REQUIRED, DRAGON_GIFTED, PLAYER_FINISHED, TICHU_CALLED, ROUND_SCORED, GAME_OVER

**Meta:** PLAYER_DISCONNECTED, PLAYER_RECONNECTED, DISCONNECT_VOTE_REQUIRED, CHAT_RECEIVED, ERROR

---

## Game Flow (State Machine)

```
lobby → grandTichuDecision (first 8 cards dealt)
      → regularTichuDecision (remaining 6 cards dealt)
      → cardPassing (pass 1 card to each other player)
      → playing (tricks until 3 players finish)
        ↳ awaitingDragonGift (if Dragon wins trick)
      → roundScoring (calculate points, check win)
        ↳ gameOver (if team >= targetScore)
        ↳ loop back to grandTichuDecision (next round)
```

---

## Data Flow

1. **Connect:** Client → `/ws?userId=&playerName=` → ConnectionManager tracks
2. **Room:** Client sends CREATE/JOIN_ROOM → RoomHandler → RoomManager → broadcasts ROOM_UPDATE
3. **Start:** Host sends START_GAME → GameStore creates GameManager → seats players → XState actor starts → broadcasts GAME_STATE
4. **Play:** Client sends game message → GameHandler → GameManager → MoveHandler validates → XState event → state transition → Broadcaster sends projected state per player
5. **Bots:** BotRunner detects state change → schedules decision (800-1500ms delay) → sends XState event
6. **Disconnect:** WS close → DisconnectHandler → vote session → resolve (wait/bot/abandon)
7. **End:** Round scoring → check win → save to DB → broadcast GAME_OVER or next round

---

## Key Conventions

- **Commit format:** `[Tag]: Description` (see `.claude/skills/diligent-developer/references/commit-formats.md`)
- **Requirement tracing:** `// REQ-F-XXX:` comments in source
- **All changes:** Via `/diligent-developer` workflow
- **Tests:** Run with `cd code && pnpm test`
- **Dev server:** `cd code && bash dev-start.sh` (or `pnpm dev`)
- **Build:** `cd code && pnpm build`

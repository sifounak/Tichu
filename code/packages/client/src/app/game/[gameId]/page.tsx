// REQ-F-DI01-DI07: Main game view with full gameplay UI
// REQ-F-HV06: Prevent invalid plays via UI
// REQ-F-HV07: Click-to-select interaction
// REQ-F-MP07: In-game chat
// REQ-F-MP08: Disconnect handling UI
// REQ-NF-U02: Tichu banner animation
'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GamePhase, detectAllBombs, CombinationType } from '@tichu/shared';
import type { ClientGameView, ServerMessage, Seat, Rank, GameCard, TichuCall, CardId, Combination, GameConfig, Team, RoundScore } from '@tichu/shared';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useBombWindow } from '@/hooks/useBombWindow';
import { useCardSelection } from '@/hooks/useCardSelection';
import { useLayoutTier } from '@/hooks/useLayoutTier';
import { useNavigationBlock } from '@/hooks/useNavigationBlock';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { AuthGuard } from '@/components/AuthGuard';
import { GameTable } from '@/components/game/GameTable';
import { PlayerSeat } from '@/components/game/PlayerSeat';
import { ActionBar } from '@/components/game/ActionBar';
import { ScorePanel } from '@/components/game/ScorePanel';
import { TichuBanner } from '@/components/game/TichuBanner';
import { ChatPanel } from '@/components/game/ChatPanel';
import { SpectatorOverlay } from '@/components/game/SpectatorOverlay';
import { SeatClaimRejectedDialog } from '@/components/game/SeatClaimRejectedDialog';
import { Card } from '@/components/cards/Card';
import { CardHand } from '@/components/cards/CardHand';
import { PhoenixValuePicker } from '@/components/cards/PhoenixValuePicker';
import { WishPicker } from '@/components/game/WishPicker';
import { PreGamePhase, GameEndPhase } from '@/components/phases';
import { PreRoomView } from '@/components/game/PreRoomView';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { ErrorToast } from '@/components/ui/ErrorToast';
import { VoteOverlay } from '@/components/game/VoteOverlay';
import { LeaveConfirmDialog } from '@/components/game/LeaveConfirmDialog';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

// REQ-F-SG01: Retrieve userId and playerName for WebSocket authentication
function getGuestId(): string {
  let id = sessionStorage.getItem('tichu_user_id');
  if (!id) {
    id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('tichu_user_id', id);
  }
  return id;
}

function GamePageInner(props: { params: Promise<{ gameId: string }> }) {
  const { gameId: urlGameId } = use(props.params);
  const router = useRouter();
  const gameStore = useGameStore();
  const uiStore = useUiStore();
  const roomCode = useRoomStore((s) => s.roomCode);
  const roomName = useRoomStore((s) => s.roomName);
  const roomPlayers = useRoomStore((s) => s.players);
  const hostSeat = useRoomStore((s) => s.hostSeat);
  const roomConfig = useRoomStore((s) => s.config);
  const spectatorCount = useRoomStore((s) => s.spectatorCount);
  const spectatorNames = useRoomStore((s) => s.spectatorNames);
  const gameInProgress = useRoomStore((s) => s.gameInProgress);
  const readyPlayers = useRoomStore((s) => s.readyPlayers);
  const mySeatFromRoom = useRoomStore((s) => s.mySeat);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  // Responsive layout tier
  const layoutTier = useLayoutTier();
  const isMobileLayout = layoutTier !== 'full';

  // REQ-F-L07: Auto-collapse chat when transitioning to mobile
  const prevLayoutRef = useRef(layoutTier);
  useEffect(() => {
    if (prevLayoutRef.current === 'full' && layoutTier !== 'full' && uiStore.chatOpen) {
      uiStore.toggleChat();
    }
    prevLayoutRef.current = layoutTier;
  }, [layoutTier, uiStore]);

  // Game-over info persisted in local state so it survives game store reset
  // (server auto-returns to pre-game after game ends, which resets the game store)
  const [savedGameOver, setSavedGameOver] = useState<{
    winner: Team;
    finalScores: Record<Team, number>;
    roundHistory: RoundScore[];
    mySeat: Seat;
  } | null>(null);

  // Leave confirmation is now handled by LeaveConfirmDialog component
  const [showVoteDropdown, setShowVoteDropdown] = useState(false);
  const voteDropdownRef = useRef<HTMLDivElement>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // REQ-F-ID01: Use auth identity when logged in, fall back to guest
  const { user: authUser, authReady, loadFromStorage: loadAuth } = useAuthStore();
  useEffect(() => { loadAuth(); }, [loadAuth]);
  const isLoggedIn = authUser !== null && !authUser.isGuest;
  const [guestId] = useState(() => typeof window !== 'undefined' ? getGuestId() : '');
  const userId = isLoggedIn ? authUser!.userId : guestId;
  const playerName = isLoggedIn
    ? authUser!.username
    : (typeof window !== 'undefined' ? (sessionStorage.getItem('tichu_player_name') ?? 'Guest') : 'Guest');

  // REQ-F-BB01: Intercept browser back/forward button with confirmation dialog
  // Placed before handleMessage so confirmNavigation is available for server-initiated navigation
  const { dialogOpen: backButtonDialogOpen, confirmNavigation, cancelNavigation } =
    useNavigationBlock({ enabled: Boolean(roomCode) });

  // REQ-F-DA01: Dog animation detection and timing
  const { enabled: animEnabled, multiplier: animMultiplier } = useAnimationSettings();
  const dogAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sound effects for game events
  const { playSound } = useSoundEffects();

  // Check if any human player still has cards (used for Dog animation & bomb window)
  const anyHumanActive = useMemo(() => {
    if (roomPlayers.length === 0) return true;
    const botSeats = new Set(roomPlayers.filter((p) => p.isBot).map((p) => p.seat));
    const finishedSeats = new Set(gameStore.finishOrder);
    return (['north', 'east', 'south', 'west'] as const).some(
      (seat) => !botSeats.has(seat) && !finishedSeats.has(seat),
    );
  }, [roomPlayers, gameStore.finishOrder]);

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === 'GAME_STATE') {
        const view = msg.state as ClientGameView;

        // REQ-F-DA01: Detect Dog play and trigger animation
        // Allow animation when the dog sender is a human player (even if they just
        // finished — their play still needs to animate). Skip only when the sender is a bot
        // and no humans remain active (pure bot-vs-bot play nobody is watching).
        const botSeats = new Set(roomPlayers.filter((p) => p.isBot).map((p) => p.seat));
        const dogSenderIsHuman = view.lastDogPlay ? !botSeats.has(view.lastDogPlay.fromSeat) : false;
        const humanStillActive = (['north', 'east', 'south', 'west'] as const).some(
          (s) => !botSeats.has(s) && !view.finishOrder.includes(s),
        );
        if (view.lastDogPlay && animEnabled && (dogSenderIsHuman || humanStillActive)) {
          playSound('dog');
          // Clear any previous Dog animation timer
          if (dogAnimTimerRef.current) clearTimeout(dogAnimTimerRef.current);
          uiStore.startDogAnimation(view.lastDogPlay.fromSeat, view.lastDogPlay.toSeat);
          // REQ-F-DA03: Entry (0.25s base) + pause (0.00s base) before exit begins
          const BASE_CARD_PLAY = 0.25;
          const DOG_PAUSE = 0.00;
          const BASE_TRICK_SWEEP = 0.40;
          const DOG_RESUME_DELAY = 0.85; // Extra pause after sweep before play resumes

          const isRoundEnding = view.phase === 'roundScoring';
          if (isRoundEnding) {
            // Dog was the final card of the round — animate entry only, leave it
            // visible in the play area until the scoring transition clears the table.
            const dogEntryMs = BASE_CARD_PLAY * animMultiplier * 1000;
            uiStore.startBombWindow(dogEntryMs);
          } else {
            // Normal mid-round dog: full entry → exit → resume sequence
            // clearDogAnimation fires after entry + pause; triggers the TrickDisplay exit animation
            const dogAnimMs = (BASE_CARD_PLAY + DOG_PAUSE) * animMultiplier * 1000;
            // REQ-F-DA05: Block plays until after sweep completes + resume delay
            // Total = (0.25 + 0.00 + 0.40 + 0.85) × multiplier = 1.50s at normal speed
            const dogBlockMs = (BASE_CARD_PLAY + DOG_PAUSE + BASE_TRICK_SWEEP + DOG_RESUME_DELAY) * animMultiplier * 1000;
            dogAnimTimerRef.current = setTimeout(
              () => uiStore.clearDogAnimation(),
              dogAnimMs,
            );
            uiStore.startBombWindow(dogBlockMs);
          }
        }

        // Detect special cards played — compare previous trick state with new one
        {
          const prevPlays = gameStore.currentTrick?.plays.length ?? 0;
          const newPlays = view.currentTrick?.plays.length ?? 0;
          if (newPlays > prevPlays && view.currentTrick) {
            const latestPlay = view.currentTrick.plays[view.currentTrick.plays.length - 1];
            if (latestPlay) {
              const cards = latestPlay.combination.cards;
              if (cards.some(gc => gc.card.kind === 'dragon')) playSound('dragon');
              if (cards.some(gc => gc.card.kind === 'phoenix')) playSound('phoenix');
              const combType = latestPlay.combination.type;
              if (combType === 'fourBomb' || combType === 'straightFlushBomb') playSound('bomb');
            }
          }
        }

        // REQ-F-DRA02/DRA03: Dragon gift animation — sweep trick toward recipient
        if (view.dragonGiftedTo && animEnabled) {
          const prevTrick = gameStore.currentTrick;
          if (prevTrick) {
            uiStore.startDragonGiftAnimation(view.dragonGiftedTo as Seat, prevTrick);
            const BASE_TRICK_SWEEP = 0.40;
            const sweepMs = BASE_TRICK_SWEEP * animMultiplier * 1000;
            setTimeout(() => uiStore.clearDragonGiftAnimation(), sweepMs + 100);
          }
        }

        // Detect new Tichu/Grand Tichu calls by comparing old state with incoming view
        {
          const prevMy = gameStore.myTichuCall;
          const newMy = view.myTichuCall;
          if (prevMy === 'none' && newMy !== 'none') {
            playSound(newMy === 'grandTichu' ? 'grandTichu' : 'tichu');
          }
          for (const op of view.otherPlayers) {
            const prevOp = gameStore.otherPlayers.find(p => p.seat === op.seat);
            if (prevOp && prevOp.tichuCall === 'none' && op.tichuCall !== 'none') {
              playSound(op.tichuCall === 'grandTichu' ? 'grandTichu' : 'tichu');
            }
          }
        }

        gameStore.applyGameState(view);

        // Save game-over info to local state so it persists after game store reset
        // (server auto-returns everyone to pre-game after game ends)
        if (view.winner !== null && view.phase === 'gameOver') {
          setSavedGameOver({
            winner: view.winner as Team,
            finalScores: view.scores,
            roundHistory: view.roundHistory,
            mySeat: view.mySeat,
          });
        }

        // REQ-F-AP12: Auto-pass resets naturally via trick-won detection and phase change.
        // Do NOT reset here — GAME_STATE fires on every state transition, not just reconnect.
      } else if (msg.type === 'CHAT_RECEIVED') {
        playSound('chat');
        // REQ-F-MP07: Chat message received — SC-04: spectator + system messages
        uiStore.addChatMessage({
          from: msg.from,
          text: msg.text,
          timestamp: Date.now(),
          spectatorName: msg.spectatorName,
        });
      } else if (msg.type === 'PLAYER_DISCONNECTED') {
        // REQ-F-ES04: Player disconnected
        uiStore.addDisconnectedSeat(msg.seat as Seat);
      } else if (msg.type === 'PLAYER_RECONNECTED') {
        uiStore.setReconnected(msg.seat as Seat);
      } else if (msg.type === 'DISCONNECT_VOTE_REQUIRED') {
        // REQ-F-ES04: Vote required (multi-disconnect support)
        uiStore.setDisconnectVoteRequired(true);
      } else if (msg.type === 'DISCONNECT_VOTE_UPDATE') {
        // REQ-F-ES04: Per-seat vote status update
        uiStore.setDisconnectVotes(msg.votes);
        uiStore.setDisconnectCountdown(Math.ceil(msg.timeoutMs / 1000));
      } else if (msg.type === 'VOTE_STARTED') {
        // REQ-F-PV05/PV07: Vote started — show overlay
        uiStore.setActiveVote({
          voteId: msg.voteId,
          voteType: msg.voteType,
          initiatorSeat: msg.initiatorSeat,
          targetSeat: msg.targetSeat,
          votes: {},
          timeoutMs: msg.timeoutMs,
        });
        uiStore.setKickTargetMode(false);
        uiStore.setVoteCountdown(Math.ceil(msg.timeoutMs / 1000));
      } else if (msg.type === 'VOTE_UPDATE') {
        // REQ-NF-PV01: Real-time vote update
        uiStore.setActiveVote({
          ...uiStore.activeVote!,
          votes: msg.votes,
          timeoutMs: msg.timeoutMs,
        });
        uiStore.setVoteCountdown(Math.ceil(msg.timeoutMs / 1000));
      } else if (msg.type === 'VOTE_RESULT') {
        // REQ-F-PV16-PV19: Vote resolved
        uiStore.setActiveVote(null);
        // REQ-F-PV16: Build kick success message with player name from seatNames
        let resultMessage = msg.message;
        if (msg.voteType === 'kick' && msg.passed && msg.targetSeat && !resultMessage) {
          const targetName = roomPlayers.find(p => p.seat === msg.targetSeat)?.name ?? msg.targetSeat;
          resultMessage = `${targetName} was kicked!`;
        }
        uiStore.setVoteResult({
          voteType: msg.voteType,
          passed: msg.passed,
          message: resultMessage,
        });
        // Clear result after 2 seconds
        setTimeout(() => {
          uiStore.setVoteResult(null);
        }, 2000);
      } else if (msg.type === 'TICHU_CALLED') {
        playSound(msg.level === 'grandTichu' ? 'grandTichu' : 'tichu');
        // REQ-NF-U02: Show Tichu banner
        uiStore.setTichuEvent({ seat: msg.seat as Seat, level: msg.level as TichuCall });
        gameStore.applyServerMessage(msg);
      } else if (msg.type === 'SEAT_OFFERED') {
        // REQ-F-ES06: Seat offer for spectator (multi-seat support)
        uiStore.setSeatOffer({ seats: msg.seats as Seat[], timeoutMs: msg.timeoutMs });
      } else if (msg.type === 'QUEUE_STATUS') {
        // REQ-F-SP08b: Queue status update
        uiStore.setQueueStatus({
          decidingSpectator: msg.decidingSpectator,
          position: msg.position,
          timeoutMs: msg.timeoutMs,
        });
      } else if (msg.type === 'SEATS_AVAILABLE') {
        // REQ-F-SP08c: Seats up for grabs
        uiStore.setAvailableSeats(msg.seats as Seat[]);
      } else if (msg.type === 'SEAT_CLAIM_REJECTED') {
        // REQ-F-SJ07: Server refused a seat claim on eligibility grounds.
        // Surface the server-authored reason + optional reclaim-original action.
        uiStore.setSeatClaimRejection({
          reason: msg.reason,
          originalSeat: msg.originalSeat as Seat,
          requestedSeat: msg.requestedSeat as Seat,
          currentOccupant: msg.currentOccupant,
          offerClaimOriginal: msg.offerClaimOriginal,
        });
      } else if (msg.type === 'ROOM_CLOSED') {
        // REQ-F-SP15: Room closed — return to lobby
        confirmNavigation(); // Disarm navigation guard before routing
        leaveRoom();
        gameStore.reset();
        sessionStorage.setItem('tichu_kicked_message', msg.message ?? 'The room was closed');
        router.push('/lobby');
      } else if (msg.type === 'ROOM_JOINED') {
        // REQ-F-SP09: Spectator promoted to player — update seat
        const roomStore = useRoomStore.getState();
        roomStore.setRoom(msg.roomCode, msg.seat);
        // Clear spectator queue state
        uiStore.setSeatOffer(null);
        uiStore.setQueueStatus(null);
        uiStore.setAvailableSeats([]);
      } else if (msg.type === 'ROOM_UPDATE') {
        // REQ-F-CG13: Handle room updates for pre-room state
        const rs = useRoomStore.getState();
        rs.updateRoom(
          msg.roomName,
          msg.players,
          msg.hostSeat,
          msg.config as GameConfig,
          msg.gameInProgress,
          msg.spectatorCount ?? 0,
          msg.spectatorNames ?? [],
          msg.readyPlayers ?? [],
        );
        // REQ-F-PV18: Game ended (restart vote) — reset game store so PreRoomView shows
        if (!msg.gameInProgress && gameStore.gameId) {
          gameStore.reset();
          uiStore.clearPlayerVoteState();
        }
      } else if (msg.type === 'KICKED') {
        confirmNavigation(); // Disarm navigation guard before routing
        leaveRoom();
        gameStore.reset();
        sessionStorage.setItem('tichu_kicked_message', msg.message ?? 'You were kicked');
        router.push('/lobby');
      } else if (msg.type === 'ROOM_LEFT') {
        confirmNavigation(); // Disarm navigation guard before routing
        leaveRoom();
        gameStore.reset();
        router.push('/lobby');
      } else if (msg.type === 'SERVER_SHUTTING_DOWN') {
        uiStore.setServerRestarting(true);
      } else if (msg.type === 'ERROR') {
        if (msg.code === 'JOIN_ROOM_FAILED' && !useRoomStore.getState().roomCode) {
          // Room doesn't exist — redirect to lobby with notification
          confirmNavigation();
          leaveRoom();
          gameStore.reset();
          sessionStorage.setItem('tichu_kicked_message', 'Requested game does not exist.');
          router.push('/lobby');
        } else if (msg.code === 'PARTNER_ALREADY_CALLED') {
          // Parse partner call level from message (format: "PARTNER_ALREADY_CALLED:grandTichu")
          const partnerCall = msg.message.split(':')[1] || 'tichu';
          // Determine which call was attempted based on game phase
          const callType = gameStore.phase === 'grandTichuDecision' ? 'grandTichu' : 'tichu';
          setPartnerCallConfirm({ type: callType, partnerCall });
        } else {
          uiStore.showErrorToast(msg.message);
        }
      } else {
        gameStore.applyServerMessage(msg);
      }
    },
    [gameStore, uiStore, leaveRoom, router, animEnabled, animMultiplier, anyHumanActive, roomPlayers, confirmNavigation, playSound],
  );

  const wsUrl = `${WS_BASE}?userId=${userId}&playerName=${encodeURIComponent(playerName)}`;
  const handleStatusChange = useCallback((s: import('@/hooks/useWebSocket').ConnectionStatus) => {
    uiStore.setConnectionStatus(s);
    if (s === 'connected') {
      uiStore.setServerRestarting(false);
    }
  }, [uiStore]);
  const { status, send, disconnect } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onStatusChange: handleStatusChange,
    enabled: authReady,
  });

  // REQ-F-CG07: Auto-join room when navigating directly to /game/[roomCode]
  useEffect(() => {
    if (status !== 'connected' || !urlGameId) return;
    const timer = setTimeout(() => {
      if (!useRoomStore.getState().roomCode) {
        send({ type: 'JOIN_ROOM', roomCode: urlGameId, playerName });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [status, urlGameId, send, playerName]);

  // REQ-F-BW01: Bomb window — 2.5s delay after each play
  const bombWindow = useBombWindow({
    send: send as (msg: Record<string, unknown>) => boolean,
  });

  // REQ-F-BW01: Start bomb window at the start of every turn (except leading a new trick).
  // This ensures players always have 2s to consider bombing, even after a sequence of passes.
  const currentTurn = gameStore.currentTurn;
  const trickPlayCount = gameStore.currentTrick?.plays.length ?? 0;
  const prevTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentTurn && currentTurn !== prevTurnRef.current && trickPlayCount > 0) {
      bombWindow.startWindow();
    }
    prevTurnRef.current = currentTurn ?? null;
  }, [currentTurn, trickPlayCount, bombWindow.startWindow]);

  // REQ-F-BI01: Compute isMyTurn early so useCardSelection can use it for bomb filtering
  const isMyTurnForSelection = gameStore.currentTurn === gameStore.mySeat;

  // REQ-F-HV06, REQ-F-HV07: Card selection with progressive filtering
  // REQ-F-BI10: Off-turn bomb selection enabled via isMyTurn param
  const activeWish = gameStore.mahjongWish && !gameStore.wishFulfilled ? gameStore.mahjongWish : null;
  const selection = useCardSelection(
    gameStore.myHand,
    gameStore.currentTrick,
    activeWish,
    uiStore.selectedCardIds,
    uiStore.toggleCard,
    uiStore.clearSelection,
    isMyTurnForSelection,
  );

  // --- Action handlers ---

  // Show received cards after the exchange
  const [showReceivedCards, setShowReceivedCards] = useState(false);

  // Partner call safeguard confirmation dialog state
  const [partnerCallConfirm, setPartnerCallConfirm] = useState<{
    type: 'grandTichu' | 'tichu';
    partnerCall: string;
  } | null>(null);

  /** Check if Mahjong is among the selected cards */
  const hasMahjongInSelection = useCallback(() => {
    const hand = gameStore.myHand;
    return hand.some(gc => selection.selectedIds.has(gc.id) && gc.card.kind === 'mahjong');
  }, [gameStore.myHand, selection.selectedIds]);

  const handlePlay = useCallback(() => {
    if (!selection.canPlay) return;
    const cardIds = [...selection.selectedIds];

    // REQ-F-PH07: If Phoenix needs value choice, show picker
    if (selection.phoenixResolution.status === 'choose') {
      uiStore.showPhoenixPicker(selection.phoenixResolution.validValues as Rank[]);
      return;
    }

    const phoenixAs = selection.phoenixResolution.status === 'auto'
      ? (selection.phoenixResolution.value as Rank)
      : undefined;

    // REQ-F-WP01: If Mahjong is in the play, show wish picker
    if (hasMahjongInSelection()) {
      uiStore.showWishPicker({ cardIds, phoenixAs });
      return;
    }

    // REQ-F-BW01: Queue non-bomb plays during bomb window
    if (bombWindow.bombWindowActive && !selection.isBombSelection) {
      uiStore.setQueuedPlay({ cardIds, phoenixAs });
      return;
    }

    if (!send({ type: 'PLAY_CARDS', cardIds, phoenixAs })) {
      uiStore.showErrorToast('Not connected to server');
      return;
    }
    uiStore.clearSelection();
    // REQ-F-AP08: Playing cards disables auto-pass
    uiStore.setAutoPassEnabled(false);
    // Auto-dismiss received cards display when playing
    if (showReceivedCards) setShowReceivedCards(false);
  }, [selection, send, uiStore, hasMahjongInSelection, bombWindow.bombWindowActive, showReceivedCards]);

  // REQ-F-BI09: Handle out-of-turn bomb play (selection-based)
  const handleBomb = useCallback(() => {
    if (!selection.isBombSelection) return;
    const cardIds = [...selection.selectedIds];
    if (!send({ type: 'PLAY_CARDS', cardIds })) {
      uiStore.showErrorToast('Not connected to server');
      return;
    }
    uiStore.clearSelection();
    // REQ-F-AP08: Playing cards (bomb) disables auto-pass
    uiStore.setAutoPassEnabled(false);
    if (showReceivedCards) setShowReceivedCards(false);
  }, [selection, send, uiStore, showReceivedCards]);

  // REQ-F-BB01: Auto-detect all bombs in hand for the Bomb button
  const handBombs = useMemo(
    () => detectAllBombs(gameStore.myHand),
    [gameStore.myHand],
  );

  // REQ-F-BB04/BB06: Play a specific bomb directly without manual card selection
  const handleBombPlay = useCallback(
    (bomb: Combination) => {
      const cardIds = bomb.cards.map((gc) => gc.id);
      if (!send({ type: 'PLAY_CARDS', cardIds })) {
        uiStore.showErrorToast('Not connected to server');
      }
      // REQ-F-AP08: Playing cards (bomb) disables auto-pass
      uiStore.setAutoPassEnabled(false);
      if (showReceivedCards) setShowReceivedCards(false);
    },
    [send, uiStore, showReceivedCards],
  );

  const [bombPopupOpen, setBombPopupOpen] = useState(false);

  const handlePhoenixChoice = useCallback(
    (value: Rank) => {
      const cardIds = [...selection.selectedIds];
      uiStore.hidePhoenixPicker();

      // REQ-F-WP01: If Mahjong is also in the play, show wish picker after Phoenix picker
      if (hasMahjongInSelection()) {
        uiStore.showWishPicker({ cardIds, phoenixAs: value });
        return;
      }

      // REQ-F-BW01: Queue during bomb window
      if (bombWindow.bombWindowActive) {
        uiStore.setQueuedPlay({ cardIds, phoenixAs: value });
      } else {
        send({ type: 'PLAY_CARDS', cardIds, phoenixAs: value });
      }
      uiStore.clearSelection();
      // REQ-F-AP08: Playing cards disables auto-pass
      uiStore.setAutoPassEnabled(false);
      if (showReceivedCards) setShowReceivedCards(false);
    },
    [selection.selectedIds, send, uiStore, hasMahjongInSelection, bombWindow.bombWindowActive, showReceivedCards],
  );

  // REQ-F-WP01: Handle wish choice from WishPicker
  const handleWishChoice = useCallback(
    (wish: Rank | null) => {
      const pending = uiStore.pendingWishPlay;
      if (!pending) return;
      uiStore.hideWishPicker();
      // REQ-F-BW01: Queue during bomb window
      if (bombWindow.bombWindowActive) {
        uiStore.setQueuedPlay({ ...pending, wish });
      } else {
        send({ type: 'PLAY_CARDS', ...pending, wish });
      }
      uiStore.clearSelection();
      // REQ-F-AP08: Playing cards disables auto-pass
      uiStore.setAutoPassEnabled(false);
      if (showReceivedCards) setShowReceivedCards(false);
    },
    [send, uiStore, bombWindow.bombWindowActive, showReceivedCards],
  );

  const handlePass = useCallback(() => {
    if (!send({ type: 'PASS_TURN' })) {
      uiStore.showErrorToast('Not connected to server');
      return;
    }
    uiStore.clearSelection();
  }, [send, uiStore]);

  const handleTichu = useCallback(() => {
    if (!send({ type: 'TICHU_DECLARATION' })) {
      uiStore.showErrorToast('Not connected to server');
    }
  }, [send, uiStore]);

  const handleGrandTichuDecision = useCallback(
    (call: boolean) => send({ type: 'GRAND_TICHU_DECISION', call }),
    [send],
  );

  const handlePartnerOverrideConfirm = useCallback(() => {
    if (!partnerCallConfirm) return;
    if (partnerCallConfirm.type === 'grandTichu') {
      send({ type: 'GRAND_TICHU_DECISION', call: true, partnerOverride: true });
    } else {
      send({ type: 'TICHU_DECLARATION', partnerOverride: true });
    }
    setPartnerCallConfirm(null);
  }, [partnerCallConfirm, send]);

  const handlePartnerOverrideCancel = useCallback(() => {
    if (!partnerCallConfirm) return;
    if (partnerCallConfirm.type === 'grandTichu') {
      // Send a GT pass instead
      send({ type: 'GRAND_TICHU_DECISION', call: false });
    }
    // For regular Tichu, just dismiss — no further action needed
    setPartnerCallConfirm(null);
  }, [partnerCallConfirm, send]);

  // --- Card passing state (lifted from PreGamePhase for visual continuity) ---
  const [passSelection, setPassSelection] = useState<Map<Seat, GameCard>>(new Map());
  const [activePassCardId, setActivePassCardId] = useState<CardId | null>(null);
  const [passConfirmed, setPassConfirmed] = useState(false);

  // showReceivedCards state moved above handlePlay (line ~315)

  // Reset card passing state when leaving the card passing phase (e.g. new round)
  const currentPhase = gameStore.phase;
  const hasReceivedCards = gameStore.receivedCards
    ? Object.values(gameStore.receivedCards).some((c) => c !== null)
    : false;

  useEffect(() => {
    if (currentPhase !== GamePhase.CardPassing && currentPhase !== GamePhase.Playing) {
      // New round — reset everything
      setPassSelection(new Map());
      setActivePassCardId(null);
      setPassConfirmed(false);
      setShowReceivedCards(false);
      useUiStore.getState().clearSelection();
      // Clear stale animation state from previous round (e.g. dog played as final card)
      useUiStore.getState().clearDogAnimation();
      useUiStore.getState().clearDragonGiftAnimation();
    } else if (currentPhase === GamePhase.CardPassing) {
      // Entering card passing — reset pass state but not received cards
      setPassConfirmed(false);
    }
  }, [currentPhase]);

  // When cards are received (phase changed to playing and receivedCards populated), show them.
  // Skip on reconnect: if the player has already played cards, they've moved past this phase.
  useEffect(() => {
    if (hasReceivedCards && currentPhase === GamePhase.Playing && !gameStore.hasPlayedCards) {
      setShowReceivedCards(true);
    }
  }, [hasReceivedCards, currentPhase, gameStore.hasPlayedCards]);

  const placedCardIds = new Set([...passSelection.values()].map((gc) => gc.id));

  const handlePassCardClick = useCallback(
    (id: CardId) => {
      if (passConfirmed) return;
      if (placedCardIds.has(id)) return;
      setActivePassCardId((prev) => (prev === id ? null : id));
    },
    [placedCardIds, passConfirmed],
  );

  const handleSlotClick = useCallback(
    (seat: Seat) => {
      if (passConfirmed) return;
      if (activePassCardId === null) {
        // No card selected — clicking a filled slot removes it
        if (passSelection.has(seat)) {
          const next = new Map(passSelection);
          next.delete(seat);
          setPassSelection(next);
        }
        return;
      }
      // Card selected — place (or replace) into this slot
      const card = gameStore.myHand.find((gc) => gc.id === activePassCardId);
      if (!card) return;
      const next = new Map(passSelection);
      next.set(seat, card);
      setPassSelection(next);
      setActivePassCardId(null);
    },
    [activePassCardId, gameStore.myHand, passSelection, passConfirmed],
  );

  const handleSlotRemove = useCallback(
    (seat: Seat) => {
      if (passConfirmed) return;
      if (!passSelection.has(seat)) return;
      const next = new Map(passSelection);
      next.delete(seat);
      setPassSelection(next);
    },
    [passSelection, passConfirmed],
  );

  const handleConfirmPass = useCallback(() => {
    if (passSelection.size !== 3) return;
    const cards: Record<string, GameCard> = {};
    for (const [seat, gc] of passSelection) {
      cards[seat] = gc;
    }
    send({ type: 'PASS_CARDS', cards: cards as Record<Seat, GameCard> });
    setPassConfirmed(true);
    setActivePassCardId(null);
  }, [passSelection, send]);

  const handleCancelPass = useCallback(() => {
    send({ type: 'CANCEL_PASS_CARDS' });
    setPassConfirmed(false);
  }, [send]);

  const handleDragonGift = useCallback(
    (to: Seat) => send({ type: 'GIFT_DRAGON', to }),
    [send],
  );

  // REQ-F-MP07: Chat send
  const handleChatSend = useCallback(
    (text: string) => send({ type: 'CHAT_MESSAGE', text }),
    [send],
  );

  // Handle seat choice when joining with multiple vacated seats
  const handleChooseSeat = useCallback(
    (seat: Seat) => send({ type: 'CHOOSE_SEAT', seat }),
    [send],
  );

  // REQ-F-SP05: Detect spectator — roomStore.mySeat is null for spectators
  // (gameStore.mySeat is 'south' for spectators after GAME_STATE arrives)
  const isSpectator = mySeatFromRoom === null;

  // Auto-skip Tichu decision phase — player can call Tichu from the ActionBar during gameplay
  // NOTE: Must be above early returns to respect Rules of Hooks
  const phase = gameStore.phase;


  // REQ-F-ES03: Close WebSocket on browser tab close so server detects disconnect via 'close' event
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isSpectator && gameInProgress) {
        disconnect();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [disconnect, isSpectator, gameInProgress]);


  // REQ-F-PV15: Countdown timer for active vote
  useEffect(() => {
    if (!uiStore.activeVote) return;
    const interval = setInterval(() => {
      uiStore.setVoteCountdown(Math.max(0, uiStore.voteCountdown - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [uiStore, uiStore.activeVote]);

  // REQ-F-PV03: Escape key cancels kick target mode and vote dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (uiStore.kickTargetMode) uiStore.setKickTargetMode(false);
        if (showVoteDropdown) setShowVoteDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiStore, showVoteDropdown]);

  // Click outside vote dropdown to dismiss
  useEffect(() => {
    if (!showVoteDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (voteDropdownRef.current && !voteDropdownRef.current.contains(e.target as Node)) {
        setShowVoteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVoteDropdown]);

  // Click outside player seats cancels kick target selection mode
  useEffect(() => {
    if (!uiStore.kickTargetMode) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[role="button"][aria-label^="Kick "]')) {
        uiStore.setKickTargetMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [uiStore, uiStore.kickTargetMode]);

  // REQ-F-AP01–AP12: Auto-pass until next trick
  const autoPassEnabled = uiStore.autoPassEnabled;

  // REQ-F-AP04: Reset auto-pass when trick is won (currentTrick transitions to null)
  const prevTrickRef = useRef(gameStore.currentTrick);
  useEffect(() => {
    const prev = prevTrickRef.current;
    prevTrickRef.current = gameStore.currentTrick;
    if (prev && !gameStore.currentTrick && autoPassEnabled) {
      uiStore.setAutoPassEnabled(false);
    }
  }, [gameStore.currentTrick, autoPassEnabled, uiStore]);

  // REQ-F-AP05: Auto-send PASS_TURN when auto-pass is enabled and it's the player's turn
  useEffect(() => {
    if (!autoPassEnabled || phase !== 'playing' || !isMyTurnForSelection) return;

    // REQ-F-AP10: Dragon gift pending → disable auto-pass
    if (gameStore.dragonGiftPending) {
      uiStore.setAutoPassEnabled(false);
      return;
    }

    // REQ-F-AP09: Don't auto-pass when leading a new trick (no trick or empty plays)
    const trick = gameStore.currentTrick;
    if (!trick || trick.plays.length === 0) return;

    // REQ-F-AP06: If player can't legally pass (wish enforcement), disable + notify
    if (!selection.canPass) {
      uiStore.setAutoPassEnabled(false);
      uiStore.showErrorToast('Auto-pass disabled: you must play a card matching the wish');
      return;
    }

    // REQ-NF-AP02: Visual delay before auto-passing
    const timer = setTimeout(() => {
      handlePass();
    }, 750);
    return () => clearTimeout(timer);
  }, [autoPassEnabled, phase, isMyTurnForSelection, gameStore.dragonGiftPending, gameStore.currentTrick, selection.canPass, handlePass, uiStore]);

  // REQ-F-DR01: Compute Dragon gift targets — opponents the player can give the trick to
  // NOTE: Must be above early returns to respect Rules of Hooks
  const mySeat = gameStore.mySeat;
  const dragonGiftTargets = useMemo(() => {
    if (!gameStore.dragonGiftPending || !mySeat) return undefined;
    if (gameStore.currentTurn !== mySeat) return undefined;
    const targets = new Set<Seat>();
    for (const p of gameStore.otherPlayers) {
      if (p.seat !== mySeat) {
        const myTeam = mySeat === 'north' || mySeat === 'south' ? 'ns' : 'ew';
        const theirTeam = p.seat === 'north' || p.seat === 'south' ? 'ns' : 'ew';
        if (myTeam !== theirTeam) {
          targets.add(p.seat);
        }
      }
    }
    return targets.size > 0 ? targets : undefined;
  }, [gameStore.dragonGiftPending, gameStore.currentTurn, mySeat, gameStore.otherPlayers]);

  // --- Pre-room state: room exists but game hasn't started ---
  if (roomCode && !gameInProgress && !gameStore.gameId) {
    const isPreRoomSpectator = mySeatFromRoom === null;
    return (
      <>
        <PreRoomView
          roomCode={roomCode}
          roomName={roomName}
          mySeat={mySeatFromRoom}
          players={roomPlayers}
          hostSeat={hostSeat}
          config={roomConfig}
          readyPlayers={readyPlayers}
          send={send as (msg: Record<string, unknown>) => boolean}
          onLeave={() => {
            confirmNavigation(); // Disarm navigation guard before routing
            send({ type: 'LEAVE_ROOM' });
            leaveRoom();
            gameStore.reset();
            router.push('/lobby');
          }}
          seatOffer={isPreRoomSpectator ? uiStore.seatOffer : undefined}
          queueStatus={isPreRoomSpectator ? uiStore.queueStatus : undefined}
          availableSeats={isPreRoomSpectator ? uiStore.availableSeats : undefined}
          onClaimSeat={isPreRoomSpectator ? () => send({ type: 'CLAIM_SEAT' }) : undefined}
          onDeclineSeat={isPreRoomSpectator ? () => { uiStore.setQueueStatus({ decidingSpectator: '', position: 0, timeoutMs: 0 }); send({ type: 'DECLINE_SEAT' }); } : undefined}
          spectatorCount={spectatorCount}
          spectatorNames={spectatorNames}
          seatClaimRejection={uiStore.seatClaimRejection}
          onDismissSeatClaimRejection={() => uiStore.clearSeatClaimRejection()}
          onClaimOriginalSeat={(seat) => send({ type: 'CLAIM_SEAT', seat })}
          backButtonDialogOpen={backButtonDialogOpen}
          onCancelNavigation={cancelNavigation}
          layoutTier={layoutTier}
        />
        {/* Game summary overlay — shown after server auto-returns to pre-game */}
        {savedGameOver && (
          <GameEndPhase
            winner={savedGameOver.winner}
            finalScores={savedGameOver.finalScores}
            roundHistory={savedGameOver.roundHistory}
            mySeat={savedGameOver.mySeat}
            onDismiss={() => setSavedGameOver(null)}
          />
        )}
      </>
    );
  }

  // --- Loading state ---
  if (!gameStore.gameId || !gameStore.phase) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Connecting to game...</h2>
          <ConnectionStatus status={status} />
        </div>
      </main>
    );
  }



  // --- Game over (shown as overlay from savedGameOver, persists after server auto-resets to pre-game) ---
  if (phase === GamePhase.GameOver && gameStore.gameOverInfo) {
    return (
      <>
        <GameEndPhase
          winner={gameStore.gameOverInfo.winner as 'northSouth' | 'eastWest'}
          finalScores={gameStore.gameOverInfo.finalScores}
          roundHistory={gameStore.roundHistory}
          mySeat={gameStore.mySeat!}
          onDismiss={() => setSavedGameOver(null)}
        />
        <ConnectionStatus status={status} />
      </>
    );
  }

  // --- Build view (used for both pre-game and playing phases) ---
  const view: ClientGameView = {
    gameId: gameStore.gameId,
    config: gameStore.config!,
    phase: gameStore.phase,
    scores: gameStore.scores!,
    roundHistory: gameStore.roundHistory,
    mySeat: gameStore.mySeat!,
    myHand: gameStore.myHand,
    myTichuCall: gameStore.myTichuCall,
    myHasPlayed: gameStore.hasPlayedCards,
    otherPlayers: gameStore.otherPlayers,
    currentTrick: gameStore.currentTrick,
    currentTurn: gameStore.currentTurn,
    mahjongWish: gameStore.mahjongWish,
    wishFulfilled: gameStore.wishFulfilled,
    finishOrder: gameStore.finishOrder,
    dragonGiftPending: gameStore.dragonGiftPending,
    dragonGiftedTo: null, // Animation handled via uiStore, not view
    receivedCards: gameStore.receivedCards,
    lastDogPlay: null, // Animation handled via uiStore, not view
    grandTichuDecided: gameStore.grandTichuDecided, // REQ-F-GT02
    cardPassConfirmed: gameStore.cardPassConfirmed,
    vacatedSeats: gameStore.vacatedSeats,
    choosingSeat: gameStore.choosingSeat,
    disconnectVotes: gameStore.disconnectVotes,
    gameHalted: gameStore.gameHalted,
    winner: null,
    turnTimerStartedAt: gameStore.turnTimerStartedAt,
    turnTimerDurationMs: gameStore.turnTimerDurationMs,
  };

  const isMyTurn = gameStore.currentTurn === mySeat;

  // Must satisfy wish: active wish, my turn, not leading (trick exists), and I can't pass
  const mustSatisfyWish = isMyTurn &&
    gameStore.mahjongWish !== null &&
    !gameStore.wishFulfilled &&
    gameStore.currentTrick !== null &&
    gameStore.currentTrick.plays.length > 0 &&
    !selection.canPass;

  const isPreGame =
    phase === GamePhase.GrandTichuDecision ||
    phase === GamePhase.CardPassing;

  // REQ-F-AP01/AP02: Show auto-pass toggle during playing phase for active (non-finished) players
  const showAutoPass = phase === 'playing'
    && !isSpectator
    && !!mySeat
    && !gameStore.finishOrder.includes(mySeat);

  // Player can select cards to pass once they have 14 cards (decided GT or in card passing phase)
  const canSelectPassCards =
    phase === GamePhase.CardPassing ||
    (phase === GamePhase.GrandTichuDecision &&
      gameStore.myHand.length >= 14);

  // Build tichu calls array for ScorePanel
  const tichuCalls = [
    { seat: mySeat!, call: gameStore.myTichuCall },
    ...gameStore.otherPlayers.map((p) => ({ seat: p.seat, call: p.tichuCall })),
  ];
  // Seats whose Tichu call has failed or succeeded
  const firstOut = view.finishOrder.length > 0 ? view.finishOrder[0] : null;
  const tichuFailedSeats = new Set(
    tichuCalls
      .filter((tc) => tc.call !== 'none' && firstOut !== null && firstOut !== tc.seat)
      .map((tc) => tc.seat),
  );
  const tichuSucceededSeats = new Set(
    tichuCalls
      .filter((tc) => tc.call !== 'none' && firstOut !== null && firstOut === tc.seat)
      .map((tc) => tc.seat),
  );

  // Build seat→name mapping from room store players
  const SEAT_LABELS: Record<string, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };
  const vacated = gameStore.vacatedSeats;
  const seatNames = {
    north: vacated.includes('north') ? '(Empty)' : roomPlayers.find((p) => p.seat === 'north')?.name ?? SEAT_LABELS.north,
    east: vacated.includes('east') ? '(Empty)' : roomPlayers.find((p) => p.seat === 'east')?.name ?? SEAT_LABELS.east,
    south: vacated.includes('south') ? '(Empty)' : roomPlayers.find((p) => p.seat === 'south')?.name ?? SEAT_LABELS.south,
    west: vacated.includes('west') ? '(Empty)' : roomPlayers.find((p) => p.seat === 'west')?.name ?? SEAT_LABELS.west,
  } as Record<Seat, string>;

  const handleLeaveGame = () => {
    send({ type: 'LEAVE_ROOM' });
  };

  const serverRestarting = uiStore.serverRestarting;

  return (
    <>
      {/* Server restart banner */}
      {serverRestarting && (
        <div data-debug-area="Server Banner" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: '#f59e0b',
          color: '#1c1917',
          textAlign: 'center',
          padding: '10px 16px',
          fontWeight: 600,
          fontSize: '14px',
          letterSpacing: '0.01em',
        }}>
          Server restarting — reconnecting automatically...
        </div>
      )}
      {/* Room code + Spectators + Leave Room — hidden in mobile mode (shown in chrome row instead) */}
      <div data-debug-area="Control Panel" style={{
        position: 'fixed',
        top: 'calc(120px * var(--scale))',
        left: 'calc(148px * var(--scale))',
        transform: 'translate(-50%, -50%)',
        zIndex: 30,
        display: isMobileLayout ? 'none' : 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}>
        {/* REQ-F-SP05: Spectating badge — above room code, same width */}
        {isSpectator && (
          <div style={{
            background: 'var(--color-gold-accent)',
            color: 'var(--color-felt-green-dark)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--card-border-radius)',
            fontSize: 'calc(26px * var(--scale))',
            fontWeight: 700,
            textAlign: 'center' as const,
            width: '100%',
          }}>
            Spectating
          </div>
        )}

        {/* Room code — button border appears on hover */}
        {roomCode && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
              setCodeCopied(true);
              setTimeout(() => setCodeCopied(false), 1000);
            }}
            style={{
              fontSize: 'var(--font-xl)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textAlign: 'center' as const,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 'var(--card-border-radius)',
              padding: 'var(--space-1) var(--space-3)',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
            aria-label="Copy room code"
          >
            Room Code: <span style={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.15em', color: 'var(--color-gold-accent)' }}>{roomCode}</span>
          </button>
        )}

        {/* Spectator count button with tooltip */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget.querySelector('button') as HTMLElement;
            const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
            if (btn) { btn.style.borderColor = 'var(--color-border)'; btn.style.background = 'rgba(255,255,255,0.1)'; }
            if (tip) tip.style.display = 'block';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget.querySelector('button') as HTMLElement;
            const tip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
            if (btn) { btn.style.borderColor = 'transparent'; btn.style.background = 'transparent'; }
            if (tip) tip.style.display = 'none';
          }}
        >
          <button
            style={{
              fontSize: 'var(--font-xl)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textAlign: 'center' as const,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 'var(--card-border-radius)',
              padding: 'var(--space-1) var(--space-3)',
              cursor: 'default',
              transition: 'border-color 0.2s',
            }}
          >
            Spectators: <span style={{ color: 'var(--color-gold-accent)', fontWeight: 900 }}>{spectatorCount}</span>
          </button>
          {spectatorNames.length > 0 && (
            <div data-tooltip style={{
              display: 'none',
              position: 'absolute',
              top: 0,
              left: '100%',
              marginLeft: 'var(--space-1)',
              minWidth: '100%',
              background: 'rgb(0,0,0)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--card-border-radius)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-xl)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              zIndex: 40,
              boxSizing: 'border-box',
            }}>
              {spectatorNames.map((name, i) => (
                <div key={i}>{name}</div>
              ))}
            </div>
          )}
        </div>

        {/* REQ-F-PV01: Start a Vote button + dropdown (full layout only — mobile uses chrome column) */}
        {!isSpectator && mySeatFromRoom && (gameInProgress || gameStore.gameId) && !uiStore.activeVote && !uiStore.disconnectVoteRequired && (
          <div ref={!isMobileLayout ? voteDropdownRef : undefined} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowVoteDropdown(!showVoteDropdown)}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--card-border-radius)',
                color: 'var(--color-text-secondary)',
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--font-xl)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
              aria-label="Start a vote"
            >
              Start a Vote
            </button>
            {showVoteDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '100%',
                  marginLeft: 'var(--space-1)',
                  background: 'rgb(0,0,0)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--card-border-radius)',
                  padding: 'var(--space-1) 0',
                  zIndex: 50,
                  minWidth: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                <button
                  onClick={() => { setShowVoteDropdown(false); uiStore.setKickTargetMode(true); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Kick Player
                </button>
                <button
                  onClick={() => { setShowVoteDropdown(false); send({ type: 'START_RESTART_ROUND_VOTE' }); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Restart Round
                </button>
                <button
                  onClick={() => { setShowVoteDropdown(false); send({ type: 'START_RESTART_GAME_VOTE' }); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Restart Game
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leave Room button with confirmation dialog */}
        <LeaveConfirmDialog
          title={isSpectator ? 'Leave Room?' : 'Leave Game?'}
          subtitle={isSpectator ? '' : 'This will count as a forfeit if you leave.'}
          onConfirm={() => { confirmNavigation(); handleLeaveGame(); }}
          externalOpen={backButtonDialogOpen}
          onClose={cancelNavigation}
        >
          {(openDialog) => (
            <button
              onClick={openDialog}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--card-border-radius)',
                color: 'var(--color-text-secondary)',
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--font-xl)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
              aria-label="Leave room"
            >
              Leave Room
            </button>
          )}
        </LeaveConfirmDialog>

        {/* Copy toast — positioned to the right so it doesn't shift buttons */}
        {codeCopied && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: '100%',
            marginLeft: 'var(--space-2)',
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--card-border-radius)',
            padding: 'var(--space-1) var(--space-3)',
            fontSize: 'var(--font-md)',
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
          }}>
            Room code copied to clipboard
          </div>
        )}
      </div>

      {/* REQ-F-SP08: Spectator overlay (seat offers, queue status, seats available) */}
      {isSpectator && (
        <SpectatorOverlay
          seatOffer={uiStore.seatOffer}
          queueStatus={uiStore.queueStatus}
          availableSeats={uiStore.availableSeats}
          disconnectVoteActive={uiStore.disconnectVoteRequired}
          onClaimSeat={() => send({ type: 'CLAIM_SEAT' })}
          onDeclineSeat={() => { uiStore.setQueueStatus({ decidingSpectator: '', position: 0, timeoutMs: 0 }); send({ type: 'DECLINE_SEAT' }); }}
          onLeaveRoom={() => send({ type: 'LEAVE_ROOM' })}
        />
      )}

      {/* REQ-F-SJ07: Mid-game seat-claim rejection dialog (mirrors the pre-room case) */}
      <SeatClaimRejectedDialog
        rejection={uiStore.seatClaimRejection}
        onClose={() => uiStore.clearSeatClaimRejection()}
        onClaimOriginal={(seat) => send({ type: 'CLAIM_SEAT', seat })}
      />


      {/* REQ-F-DI05: Score panel — full layout: fixed top-right; mobile: in chrome row */}
      {gameStore.scores && !isMobileLayout && (
        <div data-debug-area="Score Panel" style={{ position: 'fixed', top: 'calc(40px * var(--scale))', right: 'calc(28px * var(--scale))', zIndex: 30 }}>
          <ScorePanel
            scores={gameStore.scores}
            roundHistory={gameStore.roundHistory}
            tichuCalls={tichuCalls}
            targetScore={gameStore.config?.targetScore ?? 1000}
            seatNames={seatNames}
            mySeat={mySeat!}
            tichuFailedSeats={tichuFailedSeats}
            tichuSucceededSeats={tichuSucceededSeats}
            vacatedSeats={gameStore.vacatedSeats}
          />
        </div>
      )}

      {/* Mobile top chrome: left column (room info, vote, leave) + right (chat, score) */}
      {isMobileLayout && (
        <div data-debug-area="Mobile Chrome" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: 'var(--space-1) var(--space-2)',
          pointerEvents: 'none',
        }}>
          {/* Left column: [Room: #####] # watching / [Start a Vote] / [Leave Game] */}
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
            {/* Row 1: spectating badge + room code + spectator count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {isSpectator && (
                <span style={{
                  background: 'var(--color-gold-accent)',
                  color: 'var(--color-felt-green-dark)',
                  padding: '2px var(--space-2)',
                  borderRadius: 'var(--card-border-radius)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 700,
                }}>
                  Spectating
                </span>
              )}
              {roomCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomCode);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 1000);
                  }}
                  style={{
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-bg-panel)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--card-border-radius)',
                    padding: '2px var(--space-2)',
                    cursor: 'pointer',
                  }}
                  aria-label="Copy room code"
                >
                  {codeCopied ? 'Copied!' : <>Room: <span style={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.1em', color: 'var(--color-gold-accent)' }}>{roomCode}</span></>}
                </button>
              )}
              <span style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}>
                {spectatorCount} watching
              </span>
            </div>

            {/* Row 2: Start a Vote */}
            {!isSpectator && mySeatFromRoom && (gameInProgress || gameStore.gameId) && !uiStore.activeVote && !uiStore.disconnectVoteRequired && (
              <div ref={voteDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowVoteDropdown(!showVoteDropdown)}
                  style={{
                    background: 'var(--color-bg-panel)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--card-border-radius)',
                    color: 'var(--color-text-secondary)',
                    padding: '2px var(--space-2)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  aria-label="Start a vote"
                >
                  Start a Vote
                </button>
                {showVoteDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '2px',
                      background: 'rgb(0,0,0)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--card-border-radius)',
                      padding: 'var(--space-1) 0',
                      zIndex: 50,
                      minWidth: '100%',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <button
                      onClick={() => { setShowVoteDropdown(false); uiStore.setKickTargetMode(true); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-primary)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Kick Player
                    </button>
                    <button
                      onClick={() => { setShowVoteDropdown(false); send({ type: 'START_RESTART_ROUND_VOTE' }); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-primary)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Restart Round
                    </button>
                    <button
                      onClick={() => { setShowVoteDropdown(false); send({ type: 'START_RESTART_GAME_VOTE' }); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-primary)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Restart Game
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Leave Game */}
            <LeaveConfirmDialog
              title={isSpectator ? 'Leave Room?' : 'Leave Game?'}
              subtitle={isSpectator ? '' : 'This will count as a forfeit if you leave.'}
              onConfirm={() => { confirmNavigation(); handleLeaveGame(); }}
              externalOpen={backButtonDialogOpen}
              onClose={cancelNavigation}
            >
              {(openDialog) => (
                <button
                  onClick={openDialog}
                  style={{
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-bg-panel)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--card-border-radius)',
                    padding: '2px var(--space-2)',
                    cursor: 'pointer',
                  }}
                  aria-label="Leave room"
                >
                  Leave Game
                </button>
              )}
            </LeaveConfirmDialog>
          </div>

          {/* Right: chat bubble + mobile score */}
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ChatPanel
              messages={uiStore.chatMessages}
              onSend={handleChatSend}
              isOpen={uiStore.chatOpen}
              onToggle={uiStore.toggleChat}
              unreadCount={uiStore.chatUnread}
              seatNames={seatNames}
              isHost={mySeatFromRoom === hostSeat}
              isSpectator={isSpectator}
              spectatorChatEnabled={roomConfig?.spectatorChatEnabled ?? false}
              onToggleSpectatorChat={() => send({
                type: 'CONFIGURE_ROOM',
                config: { spectatorChatEnabled: !(roomConfig?.spectatorChatEnabled ?? false) },
              })}
              mobile
            />
            {gameStore.scores && (
              <ScorePanel
                scores={gameStore.scores}
                roundHistory={gameStore.roundHistory}
                tichuCalls={tichuCalls}
                targetScore={gameStore.config?.targetScore ?? 1000}
                seatNames={seatNames}
                mySeat={mySeat!}
                tichuFailedSeats={tichuFailedSeats}
                tichuSucceededSeats={tichuSucceededSeats}
                vacatedSeats={gameStore.vacatedSeats}
                compact
              />
            )}
          </div>
        </div>
      )}

      <GameTable
        view={view}
        onPlay={gameStore.gameHalted ? undefined : handlePlay}
        canPlay={!gameStore.gameHalted && !isPreGame && selection.canPlay && (isMyTurn || selection.isBombSelection)}
        isMyTurn={!gameStore.gameHalted && !isPreGame && isMyTurn}
        isTrickLeader={!gameStore.gameHalted && !isPreGame && !isMyTurn && (view.currentTrick?.currentWinner === mySeat)}
        myHasPassed={!isPreGame && (view.currentTrick?.passes.includes(mySeat!) ?? false)}
        hideCenter={isPreGame && !isSpectator}
        hideEmptyTrick={false}
        dragonGiftTargets={gameStore.gameHalted ? undefined : dragonGiftTargets}
        onDragonGift={gameStore.gameHalted ? undefined : handleDragonGift}
        seatNames={seatNames}
        mustSatisfyWish={!gameStore.gameHalted && mustSatisfyWish}
        endOfTrickBombWindowEndTime={gameStore.endOfTrickBombWindowEndTime}
        serverClockOffsetMs={gameStore.serverClockOffsetMs}
        compassLayout={isSpectator}
        layoutTier={layoutTier}
        onChooseSeat={gameStore.choosingSeat ? handleChooseSeat : undefined}
        onKickTarget={(seat: Seat) => { uiStore.setKickTargetMode(false); send({ type: 'START_KICK_VOTE', targetSeat: seat }); }}
        onAddBot={mySeatFromRoom === hostSeat && !isSpectator ? (seat: Seat) => send({ type: 'ADD_BOT', seat }) : undefined}
        centerContent={gameStore.gameHalted && !isPreGame ? (
          <div style={{ textAlign: 'center', color: 'white', fontSize: 'calc(36px * var(--scale))', fontWeight: 700, padding: 'var(--space-8)', background: 'var(--color-bg-panel)', borderRadius: 'var(--space-3)', border: '2px solid var(--color-border)' }}>
            <div style={{ fontSize: 'calc(56px * var(--scale))', marginBottom: 'var(--space-3)' }}>⏸️</div>
            Game Paused
            <div style={{ fontSize: 'calc(20px * var(--scale))', fontWeight: 400, marginTop: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>
              Waiting for players to join...
            </div>
          </div>
        ) : isSpectator && isPreGame ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'calc(18px * var(--scale))', fontWeight: 600 }}>
            Waiting for players to pass cards...
          </div>
        ) : undefined}
        bottomContent={isSpectator ? (() => {
          const hostPlayer = view.otherPlayers.find((p) => p.seat === view.mySeat);
          if (!hostPlayer) return undefined;
          const isCardPassPhase = view.phase === 'cardPassing';
          const hostPassConfirmed = isCardPassPhase && (view.cardPassConfirmed ?? []).includes(view.mySeat);
          return (
            <PlayerSeat
              seat={view.mySeat}
              displayName={seatNames[view.mySeat]}
              cardCount={hostPlayer.cardCount}
              tichuCall={hostPlayer.tichuCall}
              hasPlayed={hostPlayer.hasPlayed}
              hasPassed={view.currentTrick?.passes.includes(view.mySeat) ?? false}
              finishOrder={hostPlayer.finishOrder}
              isCurrentTurn={view.currentTurn === view.mySeat}
              isTrickLeader={(view.currentTrick?.currentWinner ?? null) === view.mySeat}
              isMe={false}
              passConfirmed={hostPassConfirmed}
              turnTimerStartedAt={view.turnTimerStartedAt}
              turnTimerDurationMs={view.turnTimerDurationMs}
              tichuFailed={hostPlayer.tichuCall !== 'none' && view.finishOrder.length > 0 && view.finishOrder[0] !== view.mySeat}
            />
          );
        })() : undefined}
      />

      {/* Bottom panel: pre-game prompt/placeholders above + always-visible hand */}
      {/* REQ-F-SP05: Hide for spectators — they see card counts in PlayerSeat, not actual hands */}
      {phase !== GamePhase.WaitingForPlayers && !isSpectator && (
        <div data-debug-area="Bottom Panel" style={{ position: 'fixed', bottom: 'calc(34px * var(--scale))', left: 0, right: 0, zIndex: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'calc(28px * var(--scale))', pointerEvents: 'none', '--card-width': layoutTier === 'mobile' ? '14vw' : 'var(--card-width-lg)', '--card-height': layoutTier === 'mobile' ? '20vw' : 'var(--card-height-lg)' } as React.CSSProperties}>
          {/* Pre-game prompts + mobile Tichu/Bomb buttons — bottom-aligned in mobile */}
          {isMobileLayout && (isPreGame || showReceivedCards) ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', paddingLeft: '5vw', paddingRight: '5vw', pointerEvents: 'none' }}>
              {/* Left: Call Tichu button */}
              <div style={{ flex: 1, pointerEvents: 'auto' }}>
                {(phase === 'playing' || phase === 'cardPassing' || (phase === 'grandTichuDecision' && mySeat && gameStore.grandTichuDecided.includes(mySeat))) && !gameStore.gameHalted && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && view.finishOrder.length === 0 && (
                  <button
                    onClick={handleTichu}
                    style={{
                      width: 'calc(var(--card-width) * 1.25 * 0.5)',
                      height: 'calc(var(--card-height) * 0.4)',
                      padding: 0,
                      border: 'none',
                      borderRadius: 'var(--space-3)',
                      background: 'var(--color-tichu-badge)',
                      color: 'white',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'calc(16px * var(--scale))',
                      fontWeight: 600,
                      cursor: 'pointer',
                      lineHeight: '1.2',
                      textAlign: 'center',
                    }}
                    aria-label="Declare Tichu"
                  >
                    Call<br />Tichu!
                  </button>
                )}
              </div>
              {/* Center: Pre-game phase content */}
              <div style={{ pointerEvents: 'auto' }}>
                {isPreGame ? (
                  <PreGamePhase
                    phase={phase}
                    mySeat={mySeat!}
                    onGrandTichuDecision={handleGrandTichuDecision}
                    passSelection={passSelection}
                    activeCardId={activePassCardId}
                    onSlotClick={handleSlotClick}
                    onSlotRemove={handleSlotRemove}
                    onConfirmPass={handleConfirmPass}
                    passConfirmed={passConfirmed}
                    onCancelPass={handleCancelPass}
                    seatNames={seatNames}
                    grandTichuDecided={view.grandTichuDecided}
                    myTichuCall={gameStore.myTichuCall}
                  />
                ) : showReceivedCards ? (
                  <PreGamePhase
                    phase={phase!}
                    mySeat={mySeat!}
                    onGrandTichuDecision={() => {}}
                    passSelection={new Map()}
                    activeCardId={null}
                    onSlotClick={() => {}}
                    onSlotRemove={() => {}}
                    onConfirmPass={() => {}}
                    passConfirmed={false}
                    onCancelPass={() => {}}
                    receivedCards={gameStore.receivedCards}
                    onDismissReceived={() => setShowReceivedCards(false)}
                    seatNames={seatNames}
                  />
                ) : null}
              </div>
              {/* Right: Bomb button */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
                {(phase === 'playing' || phase === 'grandTichuDecision' || phase === 'cardPassing') && !gameStore.gameHalted && handBombs.length > 0 && (
                  <div
                    style={{ position: 'relative', zIndex: 30 }}
                    onMouseEnter={() => handBombs.length > 0 && setBombPopupOpen(true)}
                    onMouseLeave={() => setBombPopupOpen(false)}
                  >
                    <button
                      onClick={phase === 'playing' ? () => handBombs.length === 1 ? handleBombPlay(handBombs[0]) : undefined : undefined}
                      style={{
                        width: 'calc(var(--card-width) * 1.25 * 0.5)',
                        height: 'calc(var(--card-height) * 0.4)',
                        padding: 0,
                        border: 'none',
                        borderRadius: 'var(--space-3)',
                        background: 'var(--color-tichu-badge)',
                        color: 'white',
                        fontFamily: 'var(--font-display)',
                        fontSize: 'calc(16px * var(--scale))',
                        fontWeight: 600,
                        cursor: 'pointer',
                        lineHeight: '1.2',
                        textAlign: 'center',
                      }}
                      aria-label="Play bomb"
                    >
                      Bomb!
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Pre-game prompts (no hand — hand is always rendered below) */}
              {isPreGame && (
                <div data-debug-area="Pre-Game Phase" style={{ pointerEvents: 'auto' }}>
                  <PreGamePhase
                    phase={phase}
                    mySeat={mySeat!}
                    onGrandTichuDecision={handleGrandTichuDecision}
                    passSelection={passSelection}
                    activeCardId={activePassCardId}
                    onSlotClick={handleSlotClick}
                    onSlotRemove={handleSlotRemove}
                    onConfirmPass={handleConfirmPass}
                    passConfirmed={passConfirmed}
                    onCancelPass={handleCancelPass}
                    seatNames={seatNames}
                    grandTichuDecided={view.grandTichuDecided}
                    myTichuCall={gameStore.myTichuCall}
                  />
                </div>
              )}

              {/* Received cards display — after card exchange */}
              {showReceivedCards && !isPreGame && (
                <div style={{ pointerEvents: 'auto' }}>
                  <PreGamePhase
                    phase={phase!}
                    mySeat={mySeat!}
                    onGrandTichuDecision={() => {}}
                    passSelection={new Map()}
                    activeCardId={null}
                    onSlotClick={() => {}}
                    onSlotRemove={() => {}}
                    onConfirmPass={() => {}}
                    passConfirmed={false}
                    onCancelPass={() => {}}
                    receivedCards={gameStore.receivedCards}
                    onDismissReceived={() => setShowReceivedCards(false)}
                    seatNames={seatNames}
                  />
                </div>
              )}
            </>
          )}

          {/* Mobile mode: show player's active Tichu call banner above action buttons */}
          {isMobileLayout && !isPreGame && !showReceivedCards && gameStore.myTichuCall !== 'none' && (() => {
            const myTichuFailed = mySeat ? tichuFailedSeats.has(mySeat) : false;
            const myTichuSucceeded = mySeat ? tichuSucceededSeats.has(mySeat) : false;
            const label = gameStore.myTichuCall === 'grandTichu' ? 'Grand Tichu' : 'Tichu';
            return (
              <div style={{
                pointerEvents: 'auto',
                background: myTichuFailed ? '#666'
                  : myTichuSucceeded ? '#43a047'
                  : gameStore.myTichuCall === 'grandTichu' ? 'var(--color-grand-tichu-badge)' : '#d32f2f',
                color: myTichuFailed ? 'white'
                  : myTichuSucceeded ? 'white'
                  : gameStore.myTichuCall === 'grandTichu' ? '#1a1a1a' : 'white',
                fontWeight: 800,
                fontSize: 'var(--font-sm)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                padding: 'calc(2px * var(--scale)) 0',
                borderRadius: 'var(--space-1)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                width: 'calc(180px * var(--scale))',
              }}>
                {myTichuFailed ? <>{'\u{1F629}'} <span style={{ textDecoration: 'line-through', textDecorationThickness: 'calc(3px * var(--scale))' }}>{label}</span> {'\u{1F629}'}</> : myTichuSucceeded ? `\u{1F973} ${label} \u{1F973}` : label}
              </div>
            );
          })()}

          {/* Action bar: mobile renders Tichu/Bomb inline; full layout renders only ActionBar */}
          {!isPreGame && !showReceivedCards && (
            isMobileLayout ? (
              <div data-debug-area="Action Bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'auto', width: '100%', paddingLeft: '5vw', paddingRight: '5vw' }}>
                {/* Slot: Call Tichu */}
                <div style={{ width: 'calc(var(--card-width) * 1.25 * 0.5)', height: 'calc(var(--card-height) * 0.4)', visibility: (phase === 'playing' && !gameStore.gameHalted && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && view.finishOrder.length === 0) ? 'visible' : 'hidden' }}>
                  <button
                    onClick={handleTichu}
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: 0,
                      border: 'none',
                      borderRadius: 'var(--space-3)',
                      background: 'var(--color-tichu-badge)',
                      color: 'white',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'calc(16px * var(--scale))',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1.2',
                      textAlign: 'center',
                    }}
                    aria-label="Declare Tichu"
                  >
                    Call<br />Tichu!
                  </button>
                </div>
                {/* Slot: Pass / Auto-Pass + Play */}
                <ActionBar
                  canPlay={!gameStore.gameHalted && selection.canPlay}
                  canPass={!gameStore.gameHalted && selection.canPass}
                  isMyTurn={!gameStore.gameHalted && isMyTurn}
                  phase={phase!}
                  myTichuCall={gameStore.myTichuCall}
                  hasPlayedCards={gameStore.hasPlayedCards}
                  hasBombReady={!gameStore.gameHalted && !isMyTurn && selection.isBombSelection}
                  playQueued={bombWindow.queuedPlay !== null}
                  bombWindowEndTime={bombWindow.bombWindowEndTime}
                  onCancelQueue={bombWindow.cancelQueuedPlay}
                  autoPassEnabled={autoPassEnabled}
                  onAutoPassToggle={(enabled) => uiStore.setAutoPassEnabled(enabled)}
                  showAutoPass={!gameStore.gameHalted && showAutoPass}
                  onPlay={handlePlay}
                  onPass={handlePass}
                  onTichu={handleTichu}
                  onBomb={handleBomb}
                  layoutTier={layoutTier}
                  canCallTichuProp={!gameStore.gameHalted && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && view.finishOrder.length === 0 && (gameStore.phase === 'playing' || gameStore.phase === 'cardPassing' || (gameStore.phase === 'grandTichuDecision' && mySeat != null && gameStore.grandTichuDecided.includes(mySeat)))}
                  layout="split"
                  playerSeat={
                    <PlayerSeat
                      seat={mySeat!}
                      displayName={seatNames[mySeat!]}
                      cardCount={gameStore.myHand.length}
                      tichuCall={gameStore.myTichuCall}
                      hasPlayed={false}
                      hasPassed={view.currentTrick?.passes.includes(mySeat!) ?? false}
                      finishOrder={view.finishOrder.indexOf(mySeat!) >= 0 ? view.finishOrder.indexOf(mySeat!) + 1 : null}
                      isCurrentTurn={gameStore.currentTurn === mySeat}
                      isTrickLeader={view.currentTrick?.currentWinner === mySeat}
                      isMe={true}
                      turnTimerStartedAt={view.turnTimerStartedAt}
                      turnTimerDurationMs={view.turnTimerDurationMs}
                      tichuFailed={gameStore.myTichuCall !== 'none' && view.finishOrder.length > 0 && view.finishOrder[0] !== mySeat}
                    />
                  }
                />
                {/* Slot: Bomb */}
                <div style={{ width: 'calc(var(--card-width) * 1.25 * 0.5)', height: 'calc(var(--card-height) * 0.4)', visibility: (phase === 'playing' && !gameStore.gameHalted && handBombs.length > 0) ? 'visible' : 'hidden' }}>
                  <button
                    onClick={phase === 'playing' ? () => handBombs.length === 1 ? handleBombPlay(handBombs[0]) : undefined : undefined}
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: 0,
                      border: 'none',
                      borderRadius: 'var(--space-3)',
                      background: 'var(--color-tichu-badge)',
                      color: 'white',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'calc(16px * var(--scale))',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1.2',
                      textAlign: 'center',
                    }}
                    aria-label="Play bomb"
                  >
                    Bomb!
                  </button>
                </div>
              </div>
            ) : (
              <div data-debug-area="Action Bar" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: 'center', pointerEvents: 'auto' }}>
                <ActionBar
                  canPlay={!gameStore.gameHalted && selection.canPlay}
                  canPass={!gameStore.gameHalted && selection.canPass}
                  isMyTurn={!gameStore.gameHalted && isMyTurn}
                  phase={phase!}
                  myTichuCall={gameStore.myTichuCall}
                  hasPlayedCards={gameStore.hasPlayedCards}
                  hasBombReady={!gameStore.gameHalted && !isMyTurn && selection.isBombSelection}
                  playQueued={bombWindow.queuedPlay !== null}
                  bombWindowEndTime={bombWindow.bombWindowEndTime}
                  onCancelQueue={bombWindow.cancelQueuedPlay}
                  autoPassEnabled={autoPassEnabled}
                  onAutoPassToggle={(enabled) => uiStore.setAutoPassEnabled(enabled)}
                  showAutoPass={!gameStore.gameHalted && showAutoPass}
                  onPlay={handlePlay}
                  onPass={handlePass}
                  onTichu={handleTichu}
                  onBomb={handleBomb}
                  layoutTier={layoutTier}
                  canCallTichuProp={!gameStore.gameHalted && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && view.finishOrder.length === 0 && (gameStore.phase === 'playing' || gameStore.phase === 'cardPassing' || (gameStore.phase === 'grandTichuDecision' && mySeat != null && gameStore.grandTichuDecided.includes(mySeat)))}
                  layout="split"
                  playerSeat={
                    <PlayerSeat
                      seat={mySeat!}
                      displayName={seatNames[mySeat!]}
                      cardCount={gameStore.myHand.length}
                      tichuCall={gameStore.myTichuCall}
                      hasPlayed={false}
                      hasPassed={view.currentTrick?.passes.includes(mySeat!) ?? false}
                      finishOrder={view.finishOrder.indexOf(mySeat!) >= 0 ? view.finishOrder.indexOf(mySeat!) + 1 : null}
                      isCurrentTurn={gameStore.currentTurn === mySeat}
                      isTrickLeader={view.currentTrick?.currentWinner === mySeat}
                      isMe={true}
                      turnTimerStartedAt={view.turnTimerStartedAt}
                      turnTimerDurationMs={view.turnTimerDurationMs}
                      tichuFailed={gameStore.myTichuCall !== 'none' && view.finishOrder.length > 0 && view.finishOrder[0] !== mySeat}
                    />
                  }
                />
              </div>
            )
          )}

          {/* Tichu/Grand Tichu banner — shown between pass area and cards during pre-game / received cards */}
          {(isPreGame || showReceivedCards) && gameStore.myTichuCall !== 'none' && (
            <div style={{
              pointerEvents: 'auto',
              background: gameStore.myTichuCall === 'grandTichu' ? 'var(--color-grand-tichu-badge)' : '#d32f2f',
              color: gameStore.myTichuCall === 'grandTichu' ? '#1a1a1a' : 'white',
              fontWeight: 800,
              fontSize: 'var(--font-base)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              padding: 'calc(3px * var(--scale)) calc(16px * var(--scale))',
              borderRadius: 'var(--space-1)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>
              {gameStore.myTichuCall === 'grandTichu' ? 'Grand Tichu' : 'Tichu'}
            </div>
          )}

          {/* Card hand row: [Tichu btn] [cards] [Bomb btn] — buttons offset from hand edges */}
          {/* Mobile: card_height = 20vw, card_width = 14vw (0.7 ratio); overlap 50%-60%, max hand 90vw */}
          <div data-debug-area="Card Hand Row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', maxWidth: '100%', gap: 'calc(16px * var(--scale))', '--card-width': layoutTier === 'mobile' ? '14vw' : 'var(--card-width-lg)', '--card-height': layoutTier === 'mobile' ? '20vw' : 'var(--card-height-lg)', '--card-font-size': layoutTier === 'mobile' ? 'calc(14vw * 0.235)' : 'var(--card-font-size-lg)', '--card-suit-size': layoutTier === 'mobile' ? 'calc(14vw * 0.282)' : 'var(--card-suit-size-lg)', '--card-border-radius': layoutTier === 'mobile' ? 'calc(14vw * 0.082)' : 'var(--card-border-radius-lg)', '--card-overlap-desktop': layoutTier === 'mobile' ? (gameStore.myHand.length > 1 ? `clamp(calc(14vw * 0.5), calc(14vw - (90vw - 14vw) / ${gameStore.myHand.length - 1}), calc(14vw * 0.6))` : '0px') : 'var(--card-overlap-desktop-lg)' } as React.CSSProperties}>
            {/* Left: Tichu button — full layout only (mobile renders above) */}
            {!isMobileLayout && (
              <div style={{ flexShrink: 0 }}>
                {(phase === 'playing' || phase === 'cardPassing' || (phase === 'grandTichuDecision' && mySeat && gameStore.grandTichuDecided.includes(mySeat))) && !gameStore.gameHalted && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && view.finishOrder.length === 0 && (
                  <button
                    onClick={handleTichu}
                    style={{
                      width: 'calc(84px * var(--scale))',
                      height: 'calc(84px * var(--scale))',
                      padding: 'var(--space-1)',
                      border: 'none',
                      borderRadius: 'var(--space-3)',
                      background: 'var(--color-tichu-badge)',
                      color: 'white',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'calc(21px * var(--scale))',
                      fontWeight: 600,
                      cursor: 'pointer',
                      lineHeight: '1.2',
                      textAlign: 'center',
                    }}
                    aria-label="Declare Tichu"
                  >
                    Call<br />Tichu!
                  </button>
                )}
              </div>
            )}
            {/* Center: card hand — mobile constrained to 90vw */}
            <div style={{ minWidth: 0, flexShrink: 1, display: 'flex', justifyContent: 'center', ...(layoutTier === 'mobile' ? { maxWidth: '90vw' } : {}) }}>
              <CardHand
                cards={gameStore.myHand}
                selectedIds={canSelectPassCards && !passConfirmed ? new Set<CardId>(activePassCardId !== null ? [activePassCardId] : []) : (gameStore.gameHalted ? new Set<CardId>() : selection.selectedIds)}
                disabledIds={canSelectPassCards ? placedCardIds : undefined}
                onCardClick={
                  canSelectPassCards && !passConfirmed
                    ? handlePassCardClick
                    : phase === GamePhase.Playing && !gameStore.gameHalted
                      ? selection.toggleCard
                      : undefined
                }
              />
            </div>
            {/* Right: Bomb button — full layout only (mobile renders above) */}
            {!isMobileLayout && (
              <div style={{ flexShrink: 0, position: 'relative' }}>
                {/* REQ-F-BB02: Bomb button — appears right of hand when player holds ≥1 bomb */}
                {(phase === 'playing' || phase === 'grandTichuDecision' || phase === 'cardPassing') && !gameStore.gameHalted && handBombs.length > 0 && (
                  <div
                    style={{ position: 'relative', zIndex: 30 }}
                    onMouseEnter={() => handBombs.length > 0 && setBombPopupOpen(true)}
                    onMouseLeave={() => setBombPopupOpen(false)}
                  >
                    {/* REQ-F-BB05/BB06: Multi-bomb popup — attached directly above button */}
                    {bombPopupOpen && handBombs.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 'calc(-4px * var(--scale) - 5px)',
                          paddingBottom: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: 'none',
                            borderRadius: 'var(--space-3)',
                            padding: 'calc(4px * var(--scale))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'calc(4px * var(--scale))',
                            zIndex: 50,
                          }}
                        >
                          {/* Sort: straight flushes on top (weakest→strongest), four-of-a-kind on bottom (weakest→strongest) */}
                          {[...handBombs].sort((a, b) => {
                            const aIsSF = a.type === CombinationType.StraightFlushBomb ? 0 : 1;
                            const bIsSF = b.type === CombinationType.StraightFlushBomb ? 0 : 1;
                            if (aIsSF !== bIsSF) return aIsSF - bIsSF;
                            if (a.type === CombinationType.StraightFlushBomb && b.type === CombinationType.StraightFlushBomb) {
                              if (a.length !== b.length) return a.length - b.length;
                              return a.rank - b.rank;
                            }
                            return a.rank - b.rank;
                          }).map((bomb, i) => (
                            <div
                              key={i}
                              role="button"
                              tabIndex={0}
                              onClick={phase === 'playing' ? () => { handleBombPlay(bomb); setBombPopupOpen(false); } : undefined}
                              onKeyDown={phase === 'playing' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBombPlay(bomb); setBombPopupOpen(false); } } : undefined}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 'var(--space-2)',
                                cursor: phase === 'playing' ? 'pointer' : 'default',
                                padding: 'calc(6px * var(--scale))',
                                display: 'flex',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              aria-label={bomb.type === CombinationType.FourBomb ? `Four ${bomb.rank}s bomb` : `Straight flush bomb ${bomb.cards.length} cards`}
                            >
                              {bomb.cards.map((gc, j) => (
                                <div key={gc.id} style={{ pointerEvents: 'none', marginLeft: j > 0 ? 'calc(-18px * var(--scale))' : 0, '--card-width': 'calc(42px * var(--scale))', '--card-height': 'calc(60px * var(--scale))', '--card-font-size': 'calc(11px * var(--scale))', '--card-suit-size': 'calc(13px * var(--scale))', '--card-border-radius': 'calc(4px * var(--scale))' } as React.CSSProperties}>
                                  <Card gameCard={gc} state="normal" />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* REQ-F-BB04: Single bomb plays immediately on click */}
                    <button
                      onClick={phase === 'playing' ? () => handBombs.length === 1 ? handleBombPlay(handBombs[0]) : undefined : undefined}
                      style={{
                        width: 'calc(84px * var(--scale))',
                        height: 'calc(84px * var(--scale))',
                        padding: 'var(--space-1)',
                        border: 'none',
                        borderRadius: 'var(--space-3)',
                        background: 'var(--color-tichu-badge)',
                        color: 'white',
                        fontFamily: 'var(--font-display)',
                        fontSize: 'calc(21px * var(--scale))',
                        fontWeight: 600,
                        cursor: 'pointer',
                        lineHeight: '1.2',
                        textAlign: 'center',
                      }}
                      aria-label="Play bomb"
                    >
                      Bomb!
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REQ-F-PH07: Phoenix value picker (hidden for spectators) */}
      {!isSpectator && uiStore.phoenixPickerOptions && (
        <PhoenixValuePicker
          options={uiStore.phoenixPickerOptions}
          onSelect={handlePhoenixChoice}
          onCancel={uiStore.hidePhoenixPicker}
        />
      )}

      {/* REQ-F-WP01: Wish picker for Mahjong (hidden for spectators) */}
      {!isSpectator && uiStore.wishPickerVisible && (
        <WishPicker
          onSelect={handleWishChoice}
          onCancel={uiStore.hideWishPicker}
        />
      )}

      {/* REQ-F-DR01: Dragon gift selection is now handled via PlayerSeat clicks + TrickDisplay notification */}

      {/* Round end overlay removed — only game end stats are shown */}

      {/* REQ-NF-U02: Tichu call banner */}
      {!showReceivedCards && <TichuBanner tichuEvent={uiStore.tichuEvent} />}

      {/* REQ-F-MP07: In-game chat — full layout: side panel; mobile: in chrome row */}
      {!isMobileLayout && (
      <ChatPanel
        messages={uiStore.chatMessages}
        onSend={handleChatSend}
        isOpen={uiStore.chatOpen}
        onToggle={uiStore.toggleChat}
        unreadCount={uiStore.chatUnread}
        seatNames={seatNames}
        isHost={mySeatFromRoom === hostSeat}
        isSpectator={isSpectator}
        spectatorChatEnabled={roomConfig?.spectatorChatEnabled ?? false}
        onToggleSpectatorChat={() => send({
          type: 'CONFIGURE_ROOM',
          config: { spectatorChatEnabled: !(roomConfig?.spectatorChatEnabled ?? false) },
        })}
      />
      )}

      {/* Disconnect overlay removed — vacated seats shown inline on player info boxes */}

      {/* REQ-F-PV05/PV07: Vote overlay dialog — REQ-F-VI06: spectators see read-only */}
      {uiStore.activeVote && (
        <VoteOverlay
          activeVote={uiStore.activeVote}
          mySeat={mySeat ?? 'south'}
          countdownSeconds={uiStore.voteCountdown}
          seatNames={seatNames}
          onVote={(voteId, vote) => send({ type: 'PLAYER_VOTE', voteId, vote })}
          readOnly={isSpectator}
        />
      )}

      {/* REQ-F-PV16-PV19: Vote result center status */}
      {uiStore.voteResult && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 'calc(200px * var(--scale))',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgb(0,0,0)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--space-3)',
            padding: 'var(--space-6) var(--space-8)',
            fontSize: 'var(--font-3xl)',
            fontWeight: 700,
            color: uiStore.voteResult.passed ? '#2ecc71' : '#e74c3c',
          }}>
            {uiStore.voteResult.message}
          </div>
        </div>
      )}

      <ConnectionStatus status={status} />
      <ErrorToast message={uiStore.errorToast} onDismiss={uiStore.clearErrorToast} />

      {/* Partner call safeguard confirmation dialog */}
      {partnerCallConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Partner already called"
        >
          <div
            style={{
              background: 'rgb(0,0,0)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--space-3)',
              padding: 'var(--space-6)',
              maxWidth: '400px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--color-warning, #f59e0b)' }}>
              Your partner already called {partnerCallConfirm.partnerCall === 'grandTichu' ? 'Grand Tichu' : 'Tichu'}
            </h3>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text)' }}>
              Are you sure you want to call {partnerCallConfirm.type === 'grandTichu' ? 'Grand Tichu' : 'Tichu'}?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button
                onClick={handlePartnerOverrideCancel}
                autoFocus
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--space-2)',
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePartnerOverrideConfirm}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--space-2)',
                  border: 'none',
                  background: 'var(--color-tichu-badge)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                Call {partnerCallConfirm.type === 'grandTichu' ? 'Grand Tichu' : 'Tichu'} Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function GamePage(props: { params: Promise<{ gameId: string }> }) {
  return (
    <AuthGuard>
      <GamePageInner {...props} />
    </AuthGuard>
  );
}

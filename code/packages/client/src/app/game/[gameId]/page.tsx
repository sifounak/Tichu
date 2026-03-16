// REQ-F-DI01-DI07: Main game view with full gameplay UI
// REQ-F-HV06: Prevent invalid plays via UI
// REQ-F-HV07: Click-to-select interaction
// REQ-F-MP07: In-game chat
// REQ-F-MP08: Disconnect handling UI
// REQ-NF-U02: Tichu banner animation
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GamePhase } from '@tichu/shared';
import type { ClientGameView, ServerMessage, Seat, Rank, GameCard, TichuCall, CardId } from '@tichu/shared';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useBombWindow } from '@/hooks/useBombWindow';
import { useCardSelection } from '@/hooks/useCardSelection';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useUiStore } from '@/stores/uiStore';
import { GameTable } from '@/components/game/GameTable';
import { PlayerSeat } from '@/components/game/PlayerSeat';
import { ActionBar } from '@/components/game/ActionBar';
import { ScorePanel } from '@/components/game/ScorePanel';
import { TichuBanner } from '@/components/game/TichuBanner';
import { ChatPanel } from '@/components/game/ChatPanel';
import { DisconnectOverlay } from '@/components/game/DisconnectOverlay';
import { CardHand } from '@/components/cards/CardHand';
import { PhoenixValuePicker } from '@/components/cards/PhoenixValuePicker';
import { WishPicker } from '@/components/game/WishPicker';
import { PreGamePhase, RoundEndPhase, GameEndPhase } from '@/components/phases';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { ErrorToast } from '@/components/ui/ErrorToast';

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

export default function GamePage() {
  const router = useRouter();
  const gameStore = useGameStore();
  const uiStore = useUiStore();
  const roomCode = useRoomStore((s) => s.roomCode);
  const roomPlayers = useRoomStore((s) => s.players);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // REQ-F-SG01: Include userId and playerName in WebSocket URL
  const [userId] = useState(() => typeof window !== 'undefined' ? getGuestId() : '');
  const playerName = typeof window !== 'undefined'
    ? (sessionStorage.getItem('tichu_player_name') ?? 'Guest')
    : 'Guest';

  // REQ-F-DA01: Dog animation detection and timing
  const { enabled: animEnabled, multiplier: animMultiplier } = useAnimationSettings();
  const dogAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // Skip entirely when only bots remain (no human needs to see it)
        const botSeats = new Set(roomPlayers.filter((p) => p.isBot).map((p) => p.seat));
        const humanStillActive = (['north', 'east', 'south', 'west'] as const).some(
          (s) => !botSeats.has(s) && !view.finishOrder.includes(s),
        );
        if (view.lastDogPlay && animEnabled && humanStillActive) {
          // Clear any previous Dog animation timer
          if (dogAnimTimerRef.current) clearTimeout(dogAnimTimerRef.current);
          uiStore.startDogAnimation(view.lastDogPlay.fromSeat, view.lastDogPlay.toSeat);
          // 1s pause + 0.4s sweep, scaled by animation speed
          const dogTotalMs = (1.0 + 0.4) * animMultiplier * 1000;
          dogAnimTimerRef.current = setTimeout(
            () => uiStore.clearDogAnimation(),
            dogTotalMs,
          );
          // Block plays during Dog animation (reuse bomb window mechanism)
          uiStore.startBombWindow(dogTotalMs);
        }

        gameStore.applyGameState(view);
      } else if (msg.type === 'CHAT_RECEIVED') {
        // REQ-F-MP07: Chat message received
        uiStore.addChatMessage({
          from: msg.from as Seat,
          text: msg.text as string,
          timestamp: Date.now(),
        });
      } else if (msg.type === 'PLAYER_DISCONNECTED') {
        // REQ-F-MP08: Player disconnected
        uiStore.setDisconnected(msg.seat as Seat);
      } else if (msg.type === 'PLAYER_RECONNECTED') {
        uiStore.setReconnected(msg.seat as Seat);
      } else if (msg.type === 'DISCONNECT_VOTE_REQUIRED') {
        uiStore.setDisconnectVoteRequired(true);
      } else if (msg.type === 'TICHU_CALLED') {
        // REQ-NF-U02: Show Tichu banner
        uiStore.setTichuEvent({ seat: msg.seat as Seat, level: msg.level as TichuCall });
        gameStore.applyServerMessage(msg);
      } else if (msg.type === 'ROOM_LEFT') {
        leaveRoom();
        gameStore.reset();
        router.push('/lobby');
      } else if (msg.type === 'ERROR') {
        uiStore.showErrorToast(msg.message);
      } else {
        gameStore.applyServerMessage(msg);
      }
    },
    [gameStore, uiStore, leaveRoom, router, animEnabled, animMultiplier, anyHumanActive, roomPlayers],
  );

  const wsUrl = `${WS_BASE}?userId=${userId}&playerName=${encodeURIComponent(playerName)}`;
  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onStatusChange: uiStore.setConnectionStatus,
  });

  // REQ-F-BW01: Bomb window — 2s delay after each play while humans are active
  const bombWindow = useBombWindow({
    send: send as (msg: Record<string, unknown>) => boolean,
    anyHumanActive,
  });

  // REQ-F-BW01: Start bomb window when a new play appears in the trick
  const trickPlayCount = gameStore.currentTrick?.plays.length ?? 0;
  const prevTrickPlayCountRef = useRef(0);
  useEffect(() => {
    if (trickPlayCount > prevTrickPlayCountRef.current && trickPlayCount > 0) {
      bombWindow.startWindow();
    }
    prevTrickPlayCountRef.current = trickPlayCount;
  }, [trickPlayCount, bombWindow.startWindow]);

  // REQ-F-BI01: Compute isMyTurn early so useCardSelection can use it for bomb filtering
  const isMyTurnForSelection = gameStore.currentTurn === gameStore.mySeat;

  // REQ-F-HV06, REQ-F-HV07: Card selection with progressive filtering
  // REQ-F-BI10: Off-turn bomb selection enabled via isMyTurn param
  const selection = useCardSelection(
    gameStore.myHand,
    gameStore.currentTrick,
    gameStore.mahjongWish,
    uiStore.selectedCardIds,
    uiStore.toggleCard,
    uiStore.clearSelection,
    isMyTurnForSelection,
  );

  // --- Action handlers ---

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
  }, [selection, send, uiStore, hasMahjongInSelection, bombWindow.bombWindowActive]);

  // REQ-F-BI09: Handle out-of-turn bomb play
  const handleBomb = useCallback(() => {
    if (!selection.isBombSelection) return;
    const cardIds = [...selection.selectedIds];
    if (!send({ type: 'PLAY_CARDS', cardIds })) {
      uiStore.showErrorToast('Not connected to server');
      return;
    }
    uiStore.clearSelection();
  }, [selection, send, uiStore]);

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
    },
    [selection.selectedIds, send, uiStore, hasMahjongInSelection, bombWindow.bombWindowActive],
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
    },
    [send, uiStore, bombWindow.bombWindowActive],
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

  // --- Card passing state (lifted from PreGamePhase for visual continuity) ---
  const [passSelection, setPassSelection] = useState<Map<Seat, GameCard>>(new Map());
  const [activePassCardId, setActivePassCardId] = useState<CardId | null>(null);
  const [passConfirmed, setPassConfirmed] = useState(false);

  // Show received cards after the exchange
  const [showReceivedCards, setShowReceivedCards] = useState(false);

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
    } else if (currentPhase === GamePhase.CardPassing) {
      // Entering card passing — reset pass state but not received cards
      setPassConfirmed(false);
    }
  }, [currentPhase]);

  // When cards are received (phase changed to playing and receivedCards populated), show them
  useEffect(() => {
    if (hasReceivedCards && currentPhase === GamePhase.Playing) {
      setShowReceivedCards(true);
    }
  }, [hasReceivedCards, currentPhase]);

  const placedCardIds = new Set([...passSelection.values()].map((gc) => gc.id));

  const handlePassCardClick = useCallback(
    (id: CardId) => {
      if (placedCardIds.has(id)) return;
      setActivePassCardId((prev) => (prev === id ? null : id));
    },
    [placedCardIds],
  );

  const handleSlotClick = useCallback(
    (seat: Seat) => {
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
    [activePassCardId, gameStore.myHand, passSelection],
  );

  const handleSlotRemove = useCallback(
    (seat: Seat) => {
      if (!passSelection.has(seat)) return;
      const next = new Map(passSelection);
      next.delete(seat);
      setPassSelection(next);
    },
    [passSelection],
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

  // REQ-F-MP08: Disconnect vote
  const handleDisconnectVote = useCallback(
    (vote: 'wait' | 'bot' | 'abandon') => send({ type: 'DISCONNECT_VOTE', vote }),
    [send],
  );

  // Auto-skip Tichu decision phase — player can call Tichu from the ActionBar during gameplay
  // NOTE: Must be above early returns to respect Rules of Hooks
  const phase = gameStore.phase;
  useEffect(() => {
    if (phase === GamePhase.TichuDecision) {
      send({ type: 'REGULAR_TICHU_PASS' });
    }
  }, [phase, send]);

  // Delay round end overlay so the last trick sweep animation is visible
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  useEffect(() => {
    if (phase === GamePhase.RoundScoring) {
      const timer = setTimeout(() => setShowRoundEnd(true), 1000);
      return () => clearTimeout(timer);
    }
    setShowRoundEnd(false);
  }, [phase]);

  // REQ-F-DR01: Compute Dragon gift targets — opponents the player can give the trick to
  // NOTE: Must be above early returns to respect Rules of Hooks
  const mySeat = gameStore.mySeat;
  const dragonGiftTargets = useMemo(() => {
    if (!gameStore.dragonGiftPending || !mySeat) return undefined;
    if (gameStore.currentTurn !== mySeat) return undefined;
    const targets = new Set<Seat>();
    for (const p of gameStore.otherPlayers) {
      if (p.seat !== mySeat && p.finishOrder === null) {
        const myTeam = mySeat === 'north' || mySeat === 'south' ? 'ns' : 'ew';
        const theirTeam = p.seat === 'north' || p.seat === 'south' ? 'ns' : 'ew';
        if (myTeam !== theirTeam) {
          targets.add(p.seat);
        }
      }
    }
    return targets.size > 0 ? targets : undefined;
  }, [gameStore.dragonGiftPending, gameStore.currentTurn, mySeat, gameStore.otherPlayers]);

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



  // --- Game over ---
  if (phase === GamePhase.GameOver && gameStore.gameOverInfo) {
    return (
      <>
        <GameEndPhase
          winner={gameStore.gameOverInfo.winner as 'northSouth' | 'eastWest'}
          finalScores={gameStore.gameOverInfo.finalScores}
          roundHistory={gameStore.roundHistory}
          onNewGame={() => send({ type: 'START_GAME' })}
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
    receivedCards: gameStore.receivedCards,
    lastDogPlay: null, // Animation handled via uiStore, not view
  };

  const isMyTurn = gameStore.currentTurn === mySeat;

  const isPreGame =
    phase === GamePhase.GrandTichuDecision ||
    phase === GamePhase.TichuDecision ||
    phase === GamePhase.CardPassing;

  // Build tichu calls array for ScorePanel
  const tichuCalls = [
    { seat: mySeat!, call: gameStore.myTichuCall },
    ...gameStore.otherPlayers.map((p) => ({ seat: p.seat, call: p.tichuCall })),
  ];

  // Build seat→name mapping from room store players
  const SEAT_LABELS: Record<string, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };
  const seatNames = {
    north: roomPlayers.find((p) => p.seat === 'north')?.name ?? SEAT_LABELS.north,
    east: roomPlayers.find((p) => p.seat === 'east')?.name ?? SEAT_LABELS.east,
    south: roomPlayers.find((p) => p.seat === 'south')?.name ?? SEAT_LABELS.south,
    west: roomPlayers.find((p) => p.seat === 'west')?.name ?? SEAT_LABELS.west,
  } as Record<Seat, string>;

  const handleLeaveGame = () => {
    send({ type: 'LEAVE_ROOM' });
    setShowLeaveConfirm(false);
  };

  return (
    <>
      {/* Room code + Leave Room — aligned with top-left of game table */}
      <div style={{
        position: 'fixed',
        top: 24,
        left: 28,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '6px',
      }}>
        {/* Room code — button border appears on hover */}
        {roomCode && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
              setCodeCopied(true);
              setTimeout(() => setCodeCopied(false), 1000);
            }}
            style={{
              fontFamily: 'monospace',
              fontSize: '30px',
              fontWeight: 900,
              letterSpacing: '0.2em',
              color: 'var(--color-gold-accent)',
              textAlign: 'center' as const,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
            aria-label="Copy room code"
          >
            {roomCode}
          </button>
        )}

        {/* Leave Room button */}
        <button
          onClick={() => setShowLeaveConfirm(true)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            color: 'var(--color-text-secondary)',
            padding: '6px 12px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label="Leave room"
        >
          Leave Room
        </button>

        {/* Copy toast */}
        {codeCopied && (
          <div style={{
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
          }}>
            Room code copied to clipboard
          </div>
        )}
      </div>

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px 32px',
              textAlign: 'center',
              maxWidth: '360px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Leave Game?
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              You will forfeit this game and return to the lobby.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Stay
              </button>
              <button
                onClick={handleLeaveGame}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQ-F-DI05: Score panel */}
      {gameStore.scores && (
        <div style={{ position: 'fixed', top: 24, right: 28, zIndex: 30 }}>
          <ScorePanel
            scores={gameStore.scores}
            roundHistory={gameStore.roundHistory}
            tichuCalls={tichuCalls}
            targetScore={gameStore.config?.targetScore ?? 1000}
            seatNames={seatNames}
            mySeat={mySeat!}
          />
        </div>
      )}

      <GameTable view={view} onPlay={handlePlay} canPlay={!isPreGame && !showReceivedCards && selection.canPlay && (isMyTurn || selection.isBombSelection)} hideCenter={isPreGame} hideEmptyTrick={showReceivedCards} dragonGiftTargets={dragonGiftTargets} onDragonGift={handleDragonGift} seatNames={seatNames} />

      {/* Bottom panel: pre-game prompt/placeholders above + always-visible hand */}
      {phase !== GamePhase.WaitingForPlayers && (
        <div style={{ position: 'fixed', bottom: 34, left: 0, right: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>
          {/* Pre-game prompts (no hand — hand is always rendered below) */}
          {isPreGame && (
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
            />
          )}

          {/* Received cards display — after card exchange */}
          {showReceivedCards && !isPreGame && (
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
          )}

          {/* Action bar (playing phase only, hidden while viewing received cards) */}
          {!isPreGame && !showReceivedCards && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
              <ActionBar
                canPlay={selection.canPlay}
                canPass={selection.canPass}
                isMyTurn={isMyTurn}
                phase={phase}
                myTichuCall={gameStore.myTichuCall}
                hasPlayedCards={gameStore.hasPlayedCards}
                hasBombReady={!isMyTurn && selection.isBombSelection}
                playQueued={bombWindow.queuedPlay !== null}
                onPlay={handlePlay}
                onPass={handlePass}
                onTichu={handleTichu}
                onBomb={handleBomb}
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
                  />
                }
              />
            </div>
          )}

          {/* Card hand — always rendered for visual continuity */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', '--card-width': '131px', '--card-height': '188px', '--card-font-size': '30px', '--card-suit-size': '38px', '--card-border-radius': '11px', '--card-overlap-desktop': '81px' } as React.CSSProperties}>
            {phase === 'playing' && !showReceivedCards && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && (
              <button
                onClick={handleTichu}
                style={{
                  position: 'absolute',
                  right: '100%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  marginRight: '48px',
                  width: '84px',
                  height: '84px',
                  padding: '6px',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'var(--color-tichu-badge)',
                  color: 'white',
                  fontFamily: 'var(--font-display)',
                  fontSize: '21px',
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
            <CardHand
              cards={gameStore.myHand}
              selectedIds={phase === GamePhase.CardPassing && !passConfirmed ? new Set<CardId>(activePassCardId !== null ? [activePassCardId] : []) : selection.selectedIds}
              disabledIds={phase === GamePhase.CardPassing ? placedCardIds : undefined}
              onCardClick={
                phase === GamePhase.CardPassing && !passConfirmed
                  ? handlePassCardClick
                  : phase === GamePhase.Playing
                    ? selection.toggleCard
                    : undefined
              }
            />
          </div>
        </div>
      )}

      {/* REQ-F-PH07: Phoenix value picker */}
      {uiStore.phoenixPickerOptions && (
        <PhoenixValuePicker
          options={uiStore.phoenixPickerOptions}
          onSelect={handlePhoenixChoice}
          onCancel={uiStore.hidePhoenixPicker}
        />
      )}

      {/* REQ-F-WP01: Wish picker for Mahjong */}
      {uiStore.wishPickerVisible && (
        <WishPicker
          onSelect={handleWishChoice}
          onCancel={uiStore.hideWishPicker}
        />
      )}

      {/* REQ-F-DR01: Dragon gift selection is now handled via PlayerSeat clicks + TrickDisplay notification */}

      {/* REQ-F-SC01: Round end overlay */}
      {showRoundEnd && phase === GamePhase.RoundScoring && gameStore.latestRoundScore && gameStore.scores && (
        <RoundEndPhase
          roundScore={gameStore.latestRoundScore}
          cumulativeScores={gameStore.scores}
          onContinue={() => {}}
        />
      )}

      {/* REQ-NF-U02: Tichu call banner */}
      {!showReceivedCards && <TichuBanner tichuEvent={uiStore.tichuEvent} />}

      {/* REQ-F-MP07: In-game chat */}
      <ChatPanel
        messages={uiStore.chatMessages}
        onSend={handleChatSend}
        isOpen={uiStore.chatOpen}
        onToggle={uiStore.toggleChat}
        unreadCount={uiStore.chatUnread}
        seatNames={seatNames}
      />

      {/* REQ-F-MP08: Disconnect handling */}
      <DisconnectOverlay
        disconnectedSeat={uiStore.disconnectedSeat}
        voteRequired={uiStore.disconnectVoteRequired}
        onVote={handleDisconnectVote}
        countdownSeconds={uiStore.disconnectCountdown}
        reconnectedSeat={uiStore.reconnectedSeat}
        seatNames={seatNames}
      />

      <ConnectionStatus status={status} />
      <ErrorToast message={uiStore.errorToast} onDismiss={uiStore.clearErrorToast} />
    </>
  );
}

// REQ-F-DI01-DI07: Main game view with full gameplay UI
// REQ-F-HV06: Prevent invalid plays via UI
// REQ-F-HV07: Click-to-select interaction
// REQ-F-MP07: In-game chat
// REQ-F-MP08: Disconnect handling UI
// REQ-NF-U02: Tichu banner animation
'use client';

import { useCallback, useEffect, useState } from 'react';
import { GamePhase } from '@tichu/shared';
import type { ClientGameView, ServerMessage, Seat, Rank, GameCard, TichuCall } from '@tichu/shared';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCardSelection } from '@/hooks/useCardSelection';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { GameTable } from '@/components/game/GameTable';
import { PlayerSeat } from '@/components/game/PlayerSeat';
import { ActionBar } from '@/components/game/ActionBar';
import { DragonGiftModal } from '@/components/game/DragonGiftModal';
import { ScorePanel } from '@/components/game/ScorePanel';
import { TichuBanner } from '@/components/game/TichuBanner';
import { ChatPanel } from '@/components/game/ChatPanel';
import { DisconnectOverlay } from '@/components/game/DisconnectOverlay';
import { CardHand } from '@/components/cards/CardHand';
import { PhoenixValuePicker } from '@/components/cards/PhoenixValuePicker';
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
  const gameStore = useGameStore();
  const uiStore = useUiStore();

  // REQ-F-SG01: Include userId and playerName in WebSocket URL
  const [userId] = useState(() => typeof window !== 'undefined' ? getGuestId() : '');
  const playerName = typeof window !== 'undefined'
    ? (sessionStorage.getItem('tichu_player_name') ?? 'Guest')
    : 'Guest';

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === 'GAME_STATE') {
        gameStore.applyGameState(msg.state as ClientGameView);
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
      } else if (msg.type === 'ERROR') {
        uiStore.showErrorToast(msg.message);
      } else {
        gameStore.applyServerMessage(msg);
      }
    },
    [gameStore, uiStore],
  );

  const wsUrl = `${WS_BASE}?userId=${userId}&playerName=${encodeURIComponent(playerName)}`;
  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onStatusChange: uiStore.setConnectionStatus,
  });

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

    if (!send({ type: 'PLAY_CARDS', cardIds, phoenixAs })) {
      uiStore.showErrorToast('Not connected to server');
      return;
    }
    uiStore.clearSelection();
  }, [selection, send, uiStore]);

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
      send({ type: 'PLAY_CARDS', cardIds, phoenixAs: value });
      uiStore.hidePhoenixPicker();
      uiStore.clearSelection();
    },
    [selection.selectedIds, send, uiStore],
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

  const handleTichuDecision = useCallback(
    () => send({ type: 'TICHU_DECLARATION' }),
    [send],
  );

  // REQ-F-RTP03: Send REGULAR_TICHU_PASS instead of GRAND_TICHU_DECISION
  const handleTichuSkip = useCallback(
    () => send({ type: 'REGULAR_TICHU_PASS' }),
    [send],
  );

  const handlePassCards = useCallback(
    (cards: Record<Seat, GameCard>) => {
      send({ type: 'PASS_CARDS', cards: cards as Record<Seat, GameCard> });
    },
    [send],
  );

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

  const { mySeat } = gameStore;

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
    otherPlayers: gameStore.otherPlayers,
    currentTrick: gameStore.currentTrick,
    currentTurn: gameStore.currentTurn,
    mahjongWish: gameStore.mahjongWish,
    wishFulfilled: gameStore.wishFulfilled,
    finishOrder: gameStore.finishOrder,
    dragonGiftPending: gameStore.dragonGiftPending,
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

  return (
    <>
      {/* REQ-F-DI05: Score panel */}
      {gameStore.scores && (
        <div style={{ position: 'fixed', top: 8, right: 16, zIndex: 30 }}>
          <ScorePanel
            scores={gameStore.scores}
            roundHistory={gameStore.roundHistory}
            tichuCalls={tichuCalls}
            targetScore={gameStore.config?.targetScore ?? 1000}
          />
        </div>
      )}

      <GameTable view={view} onPlay={handlePlay} canPlay={!isPreGame && selection.canPlay && (isMyTurn || selection.isBombSelection)} />

      {/* Bottom panel: pre-game prompt OR action bar + hand */}
      {phase !== GamePhase.WaitingForPlayers && (
        <div style={{ position: 'fixed', bottom: 48, left: 0, right: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>
          {isPreGame ? (
            <PreGamePhase
              phase={phase}
              myHand={gameStore.myHand}
              mySeat={mySeat!}
              onGrandTichuDecision={handleGrandTichuDecision}
              onTichuDecision={handleTichuDecision}
              onTichuSkip={handleTichuSkip}
              onPassCards={handlePassCards}
            />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <ActionBar
                  canPlay={selection.canPlay}
                  canPass={selection.canPass}
                  isMyTurn={isMyTurn}
                  phase={phase}
                  myTichuCall={gameStore.myTichuCall}
                  hasPlayedCards={gameStore.hasPlayedCards}
                  hasBombReady={!isMyTurn && selection.isBombSelection}
                  onPlay={handlePlay}
                  onPass={handlePass}
                  onTichu={handleTichu}
                  onBomb={handleBomb}
                  layout="split"
                  playerSeat={
                    <PlayerSeat
                      seat={mySeat!}
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
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', '--card-width': '131px', '--card-height': '188px', '--card-font-size': '30px', '--card-suit-size': '38px', '--card-border-radius': '11px', '--card-overlap-desktop': '81px' } as React.CSSProperties}>
                {phase === 'playing' && gameStore.myTichuCall === 'none' && !gameStore.hasPlayedCards && (
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
                  selectedIds={selection.selectedIds}
                  onCardClick={phase === GamePhase.Playing ? selection.toggleCard : undefined}
                />
              </div>
            </>
          )}
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

      {/* REQ-F-DR01: Dragon gift modal */}
      {gameStore.dragonGiftPending && gameStore.dragonGiftOptions.length > 0 && (
        <DragonGiftModal
          options={gameStore.dragonGiftOptions}
          onGift={handleDragonGift}
        />
      )}

      {/* REQ-F-SC01: Round end overlay */}
      {phase === GamePhase.RoundScoring && gameStore.latestRoundScore && gameStore.scores && (
        <RoundEndPhase
          roundScore={gameStore.latestRoundScore}
          cumulativeScores={gameStore.scores}
          onContinue={() => {}}
        />
      )}

      {/* REQ-NF-U02: Tichu call banner */}
      <TichuBanner tichuEvent={uiStore.tichuEvent} />

      {/* REQ-F-MP07: In-game chat */}
      <ChatPanel
        messages={uiStore.chatMessages}
        onSend={handleChatSend}
        isOpen={uiStore.chatOpen}
        onToggle={uiStore.toggleChat}
        unreadCount={uiStore.chatUnread}
      />

      {/* REQ-F-MP08: Disconnect handling */}
      <DisconnectOverlay
        disconnectedSeat={uiStore.disconnectedSeat}
        voteRequired={uiStore.disconnectVoteRequired}
        onVote={handleDisconnectVote}
        countdownSeconds={uiStore.disconnectCountdown}
        reconnectedSeat={uiStore.reconnectedSeat}
      />

      <ConnectionStatus status={status} />
      <ErrorToast message={uiStore.errorToast} onDismiss={uiStore.clearErrorToast} />
    </>
  );
}

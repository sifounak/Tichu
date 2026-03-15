// REQ-F-MP06: Spectator mode — read-only game view, no interaction controls
'use client';

import { useCallback } from 'react';
import { GamePhase } from '@tichu/shared';
import type { ClientGameView, ServerMessage, Seat } from '@tichu/shared';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useUiStore } from '@/stores/uiStore';
import { GameTable } from '@/components/game/GameTable';
import { ScorePanel } from '@/components/game/ScorePanel';
import { RoundEndPhase, GameEndPhase } from '@/components/phases';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import styles from './spectate.module.css';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

export default function SpectatePage() {
  const gameStore = useGameStore();
  const uiStore = useUiStore();

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === 'GAME_STATE') {
        gameStore.applyGameState(msg.state as ClientGameView);
      } else {
        gameStore.applyServerMessage(msg);
      }
    },
    [gameStore],
  );

  const { status } = useWebSocket({
    url: WS_URL,
    onMessage: handleMessage,
    onStatusChange: uiStore.setConnectionStatus,
  });

  // Loading state
  if (!gameStore.gameId || !gameStore.phase) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Joining as spectator...</h2>
          <ConnectionStatus status={status} />
        </div>
      </main>
    );
  }

  const { phase, mySeat } = gameStore;

  // Game over
  if (phase === GamePhase.GameOver && gameStore.gameOverInfo) {
    return (
      <>
        <GameEndPhase
          winner={gameStore.gameOverInfo.winner as 'northSouth' | 'eastWest'}
          finalScores={gameStore.gameOverInfo.finalScores}
          roundHistory={gameStore.roundHistory}
          onNewGame={() => {}}
        />
        <ConnectionStatus status={status} />
      </>
    );
  }

  // Build view — spectator sees public state only (no hand)
  const view: ClientGameView = {
    gameId: gameStore.gameId,
    config: gameStore.config!,
    phase: gameStore.phase,
    scores: gameStore.scores!,
    roundHistory: gameStore.roundHistory,
    mySeat: mySeat ?? 'south',
    myHand: [],
    myTichuCall: 'none',
    myHasPlayed: false,
    otherPlayers: gameStore.otherPlayers,
    currentTrick: gameStore.currentTrick,
    currentTurn: gameStore.currentTurn,
    mahjongWish: gameStore.mahjongWish,
    wishFulfilled: gameStore.wishFulfilled,
    finishOrder: gameStore.finishOrder,
    dragonGiftPending: false,
    receivedCards: { north: null, east: null, south: null, west: null },
    lastDogPlay: null,
  };

  const tichuCalls = gameStore.otherPlayers.map((p) => ({ seat: p.seat, call: p.tichuCall }));

  // Build seat→name mapping from room store players
  const roomPlayers = useRoomStore((s) => s.players);
  const SEAT_LABELS: Record<string, string> = { north: 'North', east: 'East', south: 'South', west: 'West' };
  const seatNames = {
    north: roomPlayers.find((p) => p.seat === 'north')?.name ?? SEAT_LABELS.north,
    east: roomPlayers.find((p) => p.seat === 'east')?.name ?? SEAT_LABELS.east,
    south: roomPlayers.find((p) => p.seat === 'south')?.name ?? SEAT_LABELS.south,
    west: roomPlayers.find((p) => p.seat === 'west')?.name ?? SEAT_LABELS.west,
  } as Record<Seat, string>;
  // Spectators default to viewing from north's perspective
  const spectatorSeat: Seat = gameStore.mySeat ?? 'north';

  return (
    <>
      {/* Spectator badge */}
      <div className={styles.spectatorBadge} role="status" aria-label="Spectating">
        Spectating
      </div>

      {/* Score panel */}
      {gameStore.scores && (
        <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
          <ScorePanel
            scores={gameStore.scores}
            roundHistory={gameStore.roundHistory}
            tichuCalls={tichuCalls}
            targetScore={gameStore.config?.targetScore ?? 1000}
            seatNames={seatNames}
            mySeat={spectatorSeat}
          />
        </div>
      )}

      <GameTable view={view} />

      {/* Round end overlay */}
      {phase === GamePhase.RoundScoring && gameStore.latestRoundScore && gameStore.scores && (
        <RoundEndPhase
          roundScore={gameStore.latestRoundScore}
          cumulativeScores={gameStore.scores}
          onContinue={() => {}}
        />
      )}

      <ConnectionStatus status={status} />
    </>
  );
}

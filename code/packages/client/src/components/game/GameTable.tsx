// REQ-NF-U01: Responsive game table — CSS Grid with 4 seats + center trick area
'use client';

import { memo } from 'react';
import type { ClientGameView, Seat } from '@tichu/shared';
import { useUiStore } from '@/stores/uiStore';
import { PlayerSeat } from './PlayerSeat';
import { TrickDisplay } from './TrickDisplay';
import styles from './GameTable.module.css';

export interface GameTableProps {
  view: ClientGameView;
  onPlay?: () => void;
  canPlay?: boolean;
  hideCenter?: boolean;
  hideEmptyTrick?: boolean;
  /** REQ-F-DR01: Seats eligible for Dragon gift */
  dragonGiftTargets?: Set<Seat>;
  /** Callback when a Dragon gift target is clicked */
  onDragonGift?: (seat: Seat) => void;
  /** Display names keyed by seat */
  seatNames?: Record<Seat, string>;
  /** Whether the current player must satisfy an active wish */
  mustSatisfyWish?: boolean;
}

function getOtherPlayer(view: ClientGameView, seat: Seat) {
  return view.otherPlayers.find((p) => p.seat === seat);
}

function hasPassed(view: ClientGameView, seat: Seat): boolean {
  return view.currentTrick?.passes.includes(seat) ?? false;
}

export const GameTable = memo(function GameTable({ view, onPlay, canPlay, hideCenter, hideEmptyTrick, dragonGiftTargets, onDragonGift, seatNames, mustSatisfyWish }: GameTableProps) {
  const { mySeat, currentTurn, currentTrick, mahjongWish, wishFulfilled } = view;
  const dogAnimation = useUiStore((s) => s.dogAnimation);
  const trickLeader = currentTrick?.currentWinner ?? null;

  // Determine layout: player (me) is always at the bottom
  // Partner is at the top, opponents on left and right
  const seatPositions = getSeatPositions(mySeat);

  function renderSeat(seat: Seat) {
    const isDragonTarget = dragonGiftTargets?.has(seat) ?? false;
    if (seat === mySeat) {
      return (
        <PlayerSeat
          seat={seat}
          displayName={seatNames?.[seat]}
          cardCount={view.myHand.length}
          tichuCall={view.myTichuCall}
          hasPlayed={false}
          hasPassed={hasPassed(view, seat)}
          finishOrder={view.finishOrder.indexOf(seat) >= 0 ? view.finishOrder.indexOf(seat) + 1 : null}
          isCurrentTurn={currentTurn === seat}
          isTrickLeader={trickLeader === seat}
          isMe={true}
        />
      );
    }
    const other = getOtherPlayer(view, seat);
    if (!other) return null;
    // REQ-F-GT05: During Grand Tichu decision, show 14 cards for players who have decided
    // (reflects them picking up their remaining 6 cards, as in a real game)
    const decidedInGT =
      view.phase === 'grandTichuDecision' && (view.grandTichuDecided ?? []).includes(seat);
    return (
      <PlayerSeat
        seat={seat}
        displayName={seatNames?.[seat]}
        cardCount={decidedInGT ? 14 : other.cardCount}
        tichuCall={other.tichuCall}
        hasPlayed={other.hasPlayed}
        hasPassed={hasPassed(view, seat)}
        finishOrder={other.finishOrder}
        isCurrentTurn={currentTurn === seat}
        isTrickLeader={trickLeader === seat}
        isMe={false}
        dragonTarget={isDragonTarget}
        onSeatClick={isDragonTarget ? () => onDragonGift?.(seat) : undefined}
      />
    );
  }

  return (
    <div className={styles.table} aria-label="Game table">
      {/* Partner (top) */}
      <div className={styles.top}>
        {renderSeat(seatPositions.top)}
      </div>

      {/* Left opponent */}
      <div className={styles.left}>
        {renderSeat(seatPositions.left)}
      </div>

      {/* Trick area (center) — hidden during pre-game phases */}
      {!hideCenter && (
        <div
          className={`${styles.center} ${canPlay ? styles.clickableTrick : ''}`}
          onClick={canPlay ? onPlay : undefined}
          role={canPlay ? 'button' : undefined}
          aria-label={canPlay ? 'Play selected cards' : undefined}
        >
          <TrickDisplay
            trick={currentTrick}
            mahjongWish={mahjongWish}
            wishFulfilled={wishFulfilled}
            mySeat={mySeat}
            hideEmptyPlaceholder={hideEmptyTrick}
            dogAnimation={dogAnimation}
            dragonGiftPending={dragonGiftTargets && dragonGiftTargets.size > 0}
            mustSatisfyWish={mustSatisfyWish}
          />
        </div>
      )}

      {/* Right opponent */}
      <div className={styles.right}>
        {renderSeat(seatPositions.right)}
      </div>

      {/* Player (bottom) — rendered in the fixed bottom panel in page.tsx */}
      <div className={styles.bottom} />

    </div>
  );
});

/** Map actual seats to table positions relative to the player's seat */
function getSeatPositions(mySeat: Seat): Record<'top' | 'left' | 'right' | 'bottom', Seat> {
  const order: Seat[] = ['north', 'east', 'south', 'west'];
  const myIdx = order.indexOf(mySeat);
  return {
    bottom: order[myIdx],                      // me
    right: order[(myIdx + 1) % 4],             // right opponent
    top: order[(myIdx + 2) % 4],               // partner (across)
    left: order[(myIdx + 3) % 4],              // left opponent
  };
}

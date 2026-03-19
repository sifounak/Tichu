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
  const dragonGiftAnimation = useUiStore((s) => s.dragonGiftAnimation);
  const trickLeader = currentTrick?.currentWinner ?? null;

  // Determine layout: player (me) is always at the bottom
  // Partner is at the top, opponents on left and right
  const seatPositions = getSeatPositions(mySeat);

  // Green glow for players who have confirmed their card pass
  const isCardPassing = view.phase === 'cardPassing';
  const cardPassConfirmed = view.cardPassConfirmed ?? [];

  function renderSeat(seat: Seat) {
    const isDragonCandidate = dragonGiftTargets?.has(seat) ?? false;
    const other = seat !== mySeat ? getOtherPlayer(view, seat) : null;
    // Active opponents get always-on dragon highlight; finished opponents get hover-only
    const isDragonTarget = isDragonCandidate && (other?.finishOrder === null || other?.finishOrder === undefined);
    const isDragonHoverTarget = isDragonCandidate && !isDragonTarget;
    const isPassConfirmed = isCardPassing && cardPassConfirmed.includes(seat);
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
          passConfirmed={isPassConfirmed}
        />
      );
    }
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
        dragonHoverTarget={isDragonHoverTarget}
        onSeatClick={(isDragonTarget || isDragonHoverTarget) ? () => onDragonGift?.(seat) : undefined}
        hideTrickLabels={isDragonTarget}
        passConfirmed={isPassConfirmed}
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
            dragonGiftAnimation={dragonGiftAnimation}
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

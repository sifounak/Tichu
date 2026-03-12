// REQ-NF-U01: Responsive game table — CSS Grid with 4 seats + center trick area
'use client';

import { memo } from 'react';
import type { ClientGameView, Seat } from '@tichu/shared';
import { PlayerSeat } from './PlayerSeat';
import { TrickArea } from './TrickArea';
import styles from './GameTable.module.css';

export interface GameTableProps {
  view: ClientGameView;
}

function getOtherPlayer(view: ClientGameView, seat: Seat) {
  return view.otherPlayers.find((p) => p.seat === seat);
}

function hasPassed(view: ClientGameView, seat: Seat): boolean {
  return view.currentTrick?.passes.includes(seat) ?? false;
}

export const GameTable = memo(function GameTable({ view }: GameTableProps) {
  const { mySeat, currentTurn, currentTrick, mahjongWish, wishFulfilled } = view;

  // Determine layout: player (me) is always at the bottom
  // Partner is at the top, opponents on left and right
  const seatPositions = getSeatPositions(mySeat);

  function renderSeat(seat: Seat) {
    if (seat === mySeat) {
      return (
        <PlayerSeat
          seat={seat}
          cardCount={view.myHand.length}
          tichuCall={view.myTichuCall}
          hasPlayed={false}
          hasPassed={hasPassed(view, seat)}
          finishOrder={view.finishOrder.indexOf(seat) >= 0 ? view.finishOrder.indexOf(seat) + 1 : null}
          isCurrentTurn={currentTurn === seat}
          isMe={true}
        />
      );
    }
    const other = getOtherPlayer(view, seat);
    if (!other) return null;
    return (
      <PlayerSeat
        seat={seat}
        cardCount={other.cardCount}
        tichuCall={other.tichuCall}
        hasPlayed={other.hasPlayed}
        hasPassed={hasPassed(view, seat)}
        finishOrder={other.finishOrder}
        isCurrentTurn={currentTurn === seat}
        isMe={false}
      />
    );
  }

  return (
    <div className={styles.table} aria-label="Game table">
      {/* Score display */}
      {view.scores && (
        <div className={styles.scoreBar} aria-label="Scores">
          <span className={styles.score}>NS: {view.scores.northSouth}</span>
          <span className={styles.scoreSep}>|</span>
          <span className={styles.score}>EW: {view.scores.eastWest}</span>
        </div>
      )}

      {/* Partner (top) */}
      <div className={styles.top}>
        {renderSeat(seatPositions.top)}
      </div>

      {/* Middle row: left opponent, trick area, right opponent */}
      <div className={styles.middle}>
        <div className={styles.left}>
          {renderSeat(seatPositions.left)}
        </div>
        <TrickArea
          trick={currentTrick}
          mahjongWish={mahjongWish}
          wishFulfilled={wishFulfilled}
        />
        <div className={styles.right}>
          {renderSeat(seatPositions.right)}
        </div>
      </div>

      {/* Player (bottom) */}
      <div className={styles.bottom}>
        {renderSeat(seatPositions.bottom)}
      </div>

      {/* Phase indicator */}
      <div className={styles.phaseIndicator} aria-live="polite">
        {view.phase}
      </div>
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

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
  /** Whether it's the current player's turn (shows play area glow) */
  isMyTurn?: boolean;
  /** Callback when player chooses a seat (mid-game join with multiple vacated seats) */
  onChooseSeat?: (seat: Seat) => void;
  /** Override seat rendering (e.g. for pre-room state) */
  renderSeatOverride?: (seat: Seat) => React.ReactNode;
  /** Custom content for center area (replaces TrickDisplay when provided) */
  centerContent?: React.ReactNode;
  /** Custom content for bottom area (replaces empty spacer, e.g. for spectator bottom seat) */
  bottomContent?: React.ReactNode;
  /** REQ-F-PV03: Callback when a kick target seat is clicked */
  onKickTarget?: (seat: Seat) => void;
  /** REQ-F-VI05: Callback for host to add bot to vacated seat */
  onAddBot?: (seat: Seat) => void;
  /** Fixed compass orientation (N top, S bottom, W left, E right) for spectators */
  compassLayout?: boolean;
}

function getOtherPlayer(view: ClientGameView, seat: Seat) {
  return view.otherPlayers.find((p) => p.seat === seat);
}

function hasPassed(view: ClientGameView, seat: Seat): boolean {
  return view.currentTrick?.passes.includes(seat) ?? false;
}

export const GameTable = memo(function GameTable({ view, onPlay, canPlay, hideCenter, hideEmptyTrick, dragonGiftTargets, onDragonGift, seatNames, mustSatisfyWish, isMyTurn, onChooseSeat, renderSeatOverride, centerContent, bottomContent, onKickTarget, onAddBot, compassLayout }: GameTableProps) {
  const { mySeat, currentTurn, currentTrick, mahjongWish, wishFulfilled } = view;
  const dogAnimation = useUiStore((s) => s.dogAnimation);
  const dragonGiftAnimation = useUiStore((s) => s.dragonGiftAnimation);
  // REQ-F-PV09: Vote state for glow/label overrides
  const activeVote = useUiStore((s) => s.activeVote);
  const kickTargetMode = useUiStore((s) => s.kickTargetMode);
  const trickLeader = currentTrick?.currentWinner ?? null;
  const vacatedSeats = view.vacatedSeats ?? [];
  // First player to go out — used to determine Tichu call success/failure
  const firstOutSeat = view.finishOrder.length > 0 ? view.finishOrder[0] : null;

  // Determine layout: player (me) is always at the bottom
  // Partner is at the top, opponents on left and right
  // compassLayout: fixed compass orientation for spectators (N top, S bottom, W left, E right)
  const seatPositions = compassLayout
    ? { top: 'north' as Seat, bottom: 'south' as Seat, left: 'west' as Seat, right: 'east' as Seat }
    : getSeatPositions(mySeat);

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
      // REQ-F-PV10/PV11: My vote status
      const myVoteStatus = activeVote?.votes?.[seat];
      let myPvLabel: string | undefined = undefined;
      if (activeVote && myVoteStatus != null) {
        if (activeVote.voteType === 'kick') {
          myPvLabel = myVoteStatus ? 'Voted: Kick' : "Voted: Don't Kick";
        } else {
          myPvLabel = myVoteStatus ? 'Voted: Restart' : "Voted: Don't Restart";
        }
      }
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
          seatChooserLabel={onChooseSeat ? 'Choose This Seat' : undefined}
          onChooseSeat={onChooseSeat ? () => onChooseSeat(seat) : undefined}
          playerVoteStatus={myVoteStatus ?? undefined}
          playerVoteLabel={myPvLabel}
          hideNormalLabels={!!activeVote || kickTargetMode}
          turnTimerStartedAt={view.turnTimerStartedAt}
          turnTimerDurationMs={view.turnTimerDurationMs}
          tichuFailed={view.myTichuCall !== 'none' && firstOutSeat !== null && firstOutSeat !== seat}
        />
      );
    }
    if (!other) return null;
    // REQ-F-GT05: During Grand Tichu decision, show 14 cards for players who have decided
    // (reflects them picking up their remaining 6 cards, as in a real game)
    const decidedInGT =
      view.phase === 'grandTichuDecision' && (view.grandTichuDecided ?? []).includes(seat);
    // REQ-F-PV10/PV11: Compute vote glow/label for this seat
    const seatVoteStatus = activeVote?.votes?.[seat];
    const voteType = activeVote?.voteType;
    let pvStatus: boolean | null | undefined = undefined;
    let pvLabel: string | undefined = undefined;
    if (activeVote && seatVoteStatus != null) {
      pvStatus = seatVoteStatus;
      if (voteType === 'kick') {
        pvLabel = seatVoteStatus ? 'Voted: Kick' : "Voted: Don't Kick";
      } else {
        pvLabel = seatVoteStatus ? 'Voted: Restart' : "Voted: Don't Restart";
      }
    }

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
        onSeatClick={kickTargetMode ? () => onKickTarget?.(seat) : (isDragonTarget || isDragonHoverTarget) ? () => onDragonGift?.(seat) : undefined}
        hideTrickLabels={isDragonTarget}
        passConfirmed={isPassConfirmed}
        emptySeat={vacatedSeats.includes(seat)}
        voteStatus={(view.disconnectVotes?.[seat] as 'wait' | 'kick' | null) ?? null}
        vacated={vacatedSeats.includes(seat)}
        seatChooserLabel={onChooseSeat && vacatedSeats.includes(seat) ? 'Sit Here' : undefined}
        onChooseSeat={onChooseSeat && vacatedSeats.includes(seat) ? () => onChooseSeat(seat) : undefined}
        kickVoteTarget={kickTargetMode && seat !== mySeat}
        playerVoteStatus={pvStatus ?? undefined}
        playerVoteLabel={pvLabel}
        hideNormalLabels={!!activeVote || kickTargetMode}
        onAddBot={onAddBot && vacatedSeats.includes(seat) ? () => onAddBot(seat) : undefined}
        turnTimerStartedAt={view.turnTimerStartedAt}
        turnTimerDurationMs={view.turnTimerDurationMs}
        tichuFailed={other.tichuCall !== 'none' && firstOutSeat !== null && firstOutSeat !== seat}
      />
    );
  }

  const seat = renderSeatOverride ?? renderSeat;

  return (
    <div className={styles.table} aria-label="Game table">
      {/* Partner (top) */}
      <div className={styles.top}>
        {seat(seatPositions.top)}
      </div>

      {/* Left opponent */}
      <div className={styles.left}>
        {seat(seatPositions.left)}
      </div>

      {/* Center area — custom content, TrickDisplay, or hidden */}
      {centerContent ? (
        <div className={styles.center}>
          {centerContent}
        </div>
      ) : !hideCenter ? (
        <div
          className={`${styles.center} ${isMyTurn ? styles.playAreaActive : ''} ${canPlay ? styles.clickableTrick : ''}`}
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
      ) : null}

      {/* Right opponent */}
      <div className={styles.right}>
        {seat(seatPositions.right)}
      </div>

      {/* Player (bottom) — rendered in the fixed bottom panel in page.tsx, or custom content */}
      <div className={styles.bottom}>
        {bottomContent && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
            {bottomContent}
          </div>
        )}
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

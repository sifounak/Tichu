// Verifies: REQ-F-GF09, REQ-F-GF02, REQ-F-GT03, REQ-F-GT04, REQ-F-GT05
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreGamePhase } from '../../../src/components/phases/PreGamePhase';
import type { GameCard, CardId, Rank, Seat } from '@tichu/shared';

function makeCard(id: number, rank: Rank, suit = 'jade'): GameCard {
  return { id: id as CardId, card: { kind: 'standard', suit: suit as 'jade', rank } };
}

const hand14 = Array.from({ length: 14 }, (_, i) => makeCard(i, ((i % 13) + 2) as Rank));

// Minimal set of required props to avoid crashes
const defaultProps = {
  mySeat: 'south' as Seat,
  onGrandTichuDecision: vi.fn(),
  passSelection: new Map<Seat, GameCard>(),
  activeCardId: null as CardId | null,
  onSlotClick: vi.fn(),
  onSlotRemove: vi.fn(),
  onConfirmPass: vi.fn(),
  passConfirmed: false,
  onCancelPass: vi.fn(),
};

describe('PreGamePhase', () => {
  describe('Grand Tichu Decision', () => {
    it('REQ-F-GF09: shows Grand Tichu prompt', () => {
      render(<PreGamePhase {...defaultProps} phase="grandTichuDecision" />);
      expect(screen.getByText('Grand Tichu?')).toBeInTheDocument();
      expect(screen.getByText(/\+\/-\s*200/)).toBeInTheDocument();
    });

    it('calls onGrandTichuDecision(true) on call', async () => {
      const onDecision = vi.fn();
      const user = userEvent.setup();
      render(
        <PreGamePhase {...defaultProps} phase="grandTichuDecision" onGrandTichuDecision={onDecision} />,
      );
      await user.click(screen.getByText('Grand Tichu!'));
      expect(onDecision).toHaveBeenCalledWith(true);
    });

    it('calls onGrandTichuDecision(false) on pass', async () => {
      const onDecision = vi.fn();
      const user = userEvent.setup();
      render(
        <PreGamePhase {...defaultProps} phase="grandTichuDecision" onGrandTichuDecision={onDecision} />,
      );
      await user.click(screen.getByText('Pass'));
      expect(onDecision).toHaveBeenCalledWith(false);
    });

    // REQ-F-GT03: status row is visible when player has not yet decided
    it('REQ-F-GT03: shows status row for all 4 seats when undecided', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          phase="grandTichuDecision"
          grandTichuDecided={[]}
          otherPlayerCalls={[
            { seat: 'north', tichuCall: 'none' },
            { seat: 'east', tichuCall: 'none' },
            { seat: 'west', tichuCall: 'none' },
          ]}
        />,
      );
      expect(screen.getByLabelText('Grand Tichu decisions')).toBeInTheDocument();
      // All 4 seat labels are visible (south is "South (you)")
      expect(screen.getByText(/south \(you\)/i)).toBeInTheDocument();
      expect(screen.getByText('North')).toBeInTheDocument();
      expect(screen.getByText('East')).toBeInTheDocument();
      expect(screen.getByText('West')).toBeInTheDocument();
    });

    // REQ-F-GT03: decided players show their choice before current player has decided
    it('REQ-F-GT03: shows decided players in status row before own decision', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          phase="grandTichuDecision"
          grandTichuDecided={['north', 'east']}
          otherPlayerCalls={[
            { seat: 'north', tichuCall: 'grandTichu' },
            { seat: 'east', tichuCall: 'none' },
            { seat: 'west', tichuCall: 'none' },
          ]}
        />,
      );
      // North called Grand Tichu (REQ-F-GT05), east passed
      expect(screen.getByLabelText('Grand Tichu')).toBeInTheDocument();
      expect(screen.getByLabelText('Pass')).toBeInTheDocument();
      // West and South are still waiting
      expect(screen.getAllByLabelText('Waiting').length).toBeGreaterThanOrEqual(2);
      // Buttons still visible (player hasn't decided)
      expect(screen.getByRole('button', { name: 'Grand Tichu!' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    });

    // REQ-F-GT04: waiting screen once current player has decided
    it('REQ-F-GT04: shows waiting screen after player passes', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          mySeat="south"
          phase="grandTichuDecision"
          grandTichuDecided={['south']}
          myTichuCall="none"
          otherPlayerCalls={[
            { seat: 'north', tichuCall: 'none' },
            { seat: 'east', tichuCall: 'none' },
            { seat: 'west', tichuCall: 'none' },
          ]}
        />,
      );
      expect(screen.getByText('You passed.')).toBeInTheDocument();
      expect(screen.getByText('Waiting for other players…')).toBeInTheDocument();
      // Decision buttons should be gone
      expect(screen.queryByRole('button', { name: /grand tichu!/i })).toBeNull();
    });

    // REQ-F-GT04: waiting screen shows correct title when player called Grand Tichu
    it('REQ-F-GT04: shows Grand Tichu Called! when player called', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          mySeat="south"
          phase="grandTichuDecision"
          grandTichuDecided={['south']}
          myTichuCall="grandTichu"
          otherPlayerCalls={[
            { seat: 'north', tichuCall: 'none' },
            { seat: 'east', tichuCall: 'none' },
            { seat: 'west', tichuCall: 'none' },
          ]}
        />,
      );
      expect(screen.getByText('Grand Tichu Called!')).toBeInTheDocument();
      expect(screen.getByText('Waiting for other players…')).toBeInTheDocument();
    });

    // REQ-F-GT04: waiting screen still shows status row
    it('REQ-F-GT04: status row visible in waiting screen', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          mySeat="south"
          phase="grandTichuDecision"
          grandTichuDecided={['south', 'north']}
          myTichuCall="none"
          otherPlayerCalls={[
            { seat: 'north', tichuCall: 'grandTichu' },
            { seat: 'east', tichuCall: 'none' },
            { seat: 'west', tichuCall: 'none' },
          ]}
        />,
      );
      expect(screen.getByLabelText('Grand Tichu decisions')).toBeInTheDocument();
    });

    // REQ-F-GT05: Grand Tichu callers get distinct aria-label from passers
    it('REQ-F-GT05: Grand Tichu callers are visually distinct from passers', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          phase="grandTichuDecision"
          grandTichuDecided={['north', 'east']}
          otherPlayerCalls={[
            { seat: 'north', tichuCall: 'grandTichu' },
            { seat: 'east', tichuCall: 'none' },
            { seat: 'west', tichuCall: 'none' },
          ]}
        />,
      );
      const gtBadge = screen.getByLabelText('Grand Tichu');
      const passBadge = screen.getByLabelText('Pass');
      // They should have different class names (visual distinction)
      expect(gtBadge.className).not.toBe(passBadge.className);
    });
  });

  describe('Card Passing', () => {
    it('REQ-F-GF02: shows card passing title and instruction', () => {
      render(<PreGamePhase {...defaultProps} phase="cardPassing" myHand={hand14} />);
      expect(screen.getByText('Pass Cards')).toBeInTheDocument();
      expect(screen.getByText(/select a card.*click a slot/i)).toBeInTheDocument();
    });

    it('shows placeholder slots for all 3 targets', () => {
      render(<PreGamePhase {...defaultProps} phase="cardPassing" />);
      // South → partner (North), left opponent (West), right opponent (East)
      expect(screen.getByText('North')).toBeInTheDocument();
      expect(screen.getByText('West')).toBeInTheDocument();
      expect(screen.getByText('East')).toBeInTheDocument();
    });
  });

  it('returns null for unknown phase', () => {
    const { container } = render(
      <PreGamePhase {...defaultProps} phase="playing" />,
    );
    expect(container.firstChild).toBeNull();
  });
});

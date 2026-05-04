// Verifies: REQ-F-GF09, REQ-F-GF02, REQ-F-GT03, REQ-F-GT04, REQ-F-GT05
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreGamePhase } from '../../../src/components/phases/PreGamePhase';
import type { GameCard, CardId, Seat } from '@tichu/shared';

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
      expect(screen.getByText(/200/)).toBeInTheDocument();
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

    // REQ-F-GT03/GT04: After deciding, component falls through to card passing UI
    // (Grand Tichu status is now shown on player seats in GameTable, not in PreGamePhase)
    it('REQ-F-GT04: shows card passing UI after player has decided', () => {
      render(
        <PreGamePhase
          {...defaultProps}
          phase="grandTichuDecision"
          grandTichuDecided={['south']}
        />,
      );
      // Decision buttons should be gone
      expect(screen.queryByRole('button', { name: /grand tichu!/i })).toBeNull();
      // Card passing UI is shown instead
      expect(screen.getByText('Pass Cards')).toBeInTheDocument();
    });
  });

  describe('Card Passing', () => {
    it('REQ-F-GF02: shows card passing title and instruction', () => {
      render(<PreGamePhase {...defaultProps} phase="cardPassing" />);
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

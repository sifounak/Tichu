// Verifies: REQ-F-GF09, REQ-F-GF08, REQ-F-GF02
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreGamePhase } from '../../../src/components/phases/PreGamePhase';
import type { GameCard, CardId, Rank } from '@tichu/shared';

function makeCard(id: number, rank: Rank, suit = 'jade'): GameCard {
  return { id: id as CardId, card: { kind: 'standard', suit: suit as 'jade', rank } };
}

const hand8 = Array.from({ length: 8 }, (_, i) => makeCard(i, (i + 2) as Rank));
const hand14 = Array.from({ length: 14 }, (_, i) => makeCard(i, ((i % 13) + 2) as Rank));

const defaultProps = {
  myHand: hand8,
  mySeat: 'south' as const,
  onGrandTichuDecision: vi.fn(),
  onTichuDecision: vi.fn(),
  onTichuSkip: vi.fn(),
  onPassCards: vi.fn(),
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

    it('renders the hand (8 cards)', () => {
      render(<PreGamePhase {...defaultProps} phase="grandTichuDecision" />);
      expect(screen.getByLabelText('Your hand')).toBeInTheDocument();
    });
  });

  describe('Tichu Decision', () => {
    it('REQ-F-GF08: shows Tichu prompt', () => {
      render(<PreGamePhase {...defaultProps} phase="tichuDecision" myHand={hand14} />);
      expect(screen.getByText('Tichu?')).toBeInTheDocument();
      expect(screen.getByText(/\+\/-\s*100/)).toBeInTheDocument();
    });

    it('calls onTichuDecision on call', async () => {
      const onDecision = vi.fn();
      const user = userEvent.setup();
      render(
        <PreGamePhase {...defaultProps} phase="tichuDecision" myHand={hand14} onTichuDecision={onDecision} />,
      );
      await user.click(screen.getByText('Tichu!'));
      expect(onDecision).toHaveBeenCalledTimes(1);
    });
  });

  describe('Card Passing', () => {
    it('REQ-F-GF02: shows card passing title and instruction', () => {
      render(<PreGamePhase {...defaultProps} phase="cardPassing" myHand={hand14} />);
      expect(screen.getByText('Pass Cards')).toBeInTheDocument();
      expect(screen.getByText(/select a card.*click a slot/i)).toBeInTheDocument();
    });

    it('shows placeholder slots for all 3 targets', () => {
      render(<PreGamePhase {...defaultProps} phase="cardPassing" myHand={hand14} />);
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

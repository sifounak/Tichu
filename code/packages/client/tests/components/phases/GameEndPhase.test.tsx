// Verifies: REQ-F-GS01, REQ-F-GS02, REQ-F-GS08
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameEndPhase } from '../../../src/components/phases/GameEndPhase';
import type { Team, Seat, RoundScore } from '@tichu/shared';

const finalScores: Record<Team, number> = { northSouth: 1050, eastWest: 780 };
const roundHistory: RoundScore[] = [
  {
    roundNumber: 1,
    cardPoints: { northSouth: 75, eastWest: 25 },
    tichuBonuses: { northSouth: 0, eastWest: 0 },
    oneTwoBonus: null,
    total: { northSouth: 75, eastWest: 25 },
    tichuResults: { north: null, east: null, south: null, west: null },
    bombsPerTeam: { northSouth: 0, eastWest: 0 },
    finishOrder: ['north', 'east', 'south', 'west'] as Seat[],
  },
];

const defaultProps = {
  winner: 'northSouth' as Team,
  finalScores,
  roundHistory,
  mySeat: 'south' as Seat,
  onDismiss: vi.fn(),
};

describe('GameEndPhase', () => {
  it('shows game over dialog', () => {
    render(<GameEndPhase {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: /game over/i })).toBeInTheDocument();
  });

  it('REQ-F-GS02: shows You won! when on winning team', () => {
    render(<GameEndPhase {...defaultProps} mySeat="south" winner="northSouth" />);
    expect(screen.getByText('You won!')).toBeInTheDocument();
  });

  it('REQ-F-GS02: shows You lost! when on losing team', () => {
    render(<GameEndPhase {...defaultProps} mySeat="east" winner="northSouth" />);
    expect(screen.getByText('You lost!')).toBeInTheDocument();
  });

  it('REQ-F-GS08: shows final scores', () => {
    render(<GameEndPhase {...defaultProps} />);
    expect(screen.getByText('1050')).toBeInTheDocument();
    expect(screen.getByText('780')).toBeInTheDocument();
  });

  it('REQ-F-GS03: shows 2-column stat layout', () => {
    render(<GameEndPhase {...defaultProps} />);
    expect(screen.getByText('Your Team')).toBeInTheDocument();
    expect(screen.getByText('Their Team')).toBeInTheDocument();
  });

  it('calls onDismiss when Dismiss button clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<GameEndPhase {...defaultProps} onDismiss={onDismiss} />);
    await user.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

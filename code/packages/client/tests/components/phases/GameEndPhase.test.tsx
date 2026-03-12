// Verifies: REQ-F-GF10
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameEndPhase } from '../../../src/components/phases/GameEndPhase';
import type { Team, RoundScore } from '@tichu/shared';

const finalScores: Record<Team, number> = { northSouth: 1050, eastWest: 780 };
const roundHistory: RoundScore[] = [
  {
    roundNumber: 1,
    cardPoints: { northSouth: 75, eastWest: 25 },
    tichuBonuses: { northSouth: 0, eastWest: 0 },
    oneTwoBonus: null,
    total: { northSouth: 75, eastWest: 25 },
  },
];

describe('GameEndPhase', () => {
  it('shows game over dialog', () => {
    render(
      <GameEndPhase
        winner="northSouth"
        finalScores={finalScores}
        roundHistory={roundHistory}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: /game over/i })).toBeInTheDocument();
    expect(screen.getByText('Game Over')).toBeInTheDocument();
  });

  it('shows winner team', () => {
    render(
      <GameEndPhase
        winner="northSouth"
        finalScores={finalScores}
        roundHistory={roundHistory}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByText('North-South Wins!')).toBeInTheDocument();
  });

  it('shows east-west winner', () => {
    render(
      <GameEndPhase
        winner="eastWest"
        finalScores={finalScores}
        roundHistory={roundHistory}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByText('East-West Wins!')).toBeInTheDocument();
  });

  it('shows final scores', () => {
    render(
      <GameEndPhase
        winner="northSouth"
        finalScores={finalScores}
        roundHistory={roundHistory}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByText('1050')).toBeInTheDocument();
    expect(screen.getByText('780')).toBeInTheDocument();
  });

  it('shows round history in expandable details', () => {
    render(
      <GameEndPhase
        winner="northSouth"
        finalScores={finalScores}
        roundHistory={roundHistory}
        onNewGame={vi.fn()}
      />,
    );
    expect(screen.getByText(/Round History/)).toBeInTheDocument();
  });

  it('calls onNewGame when button clicked', async () => {
    const onNewGame = vi.fn();
    const user = userEvent.setup();
    render(
      <GameEndPhase
        winner="northSouth"
        finalScores={finalScores}
        roundHistory={roundHistory}
        onNewGame={onNewGame}
      />,
    );
    await user.click(screen.getByText('New Game'));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });
});

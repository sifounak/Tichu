// Verifies: REQ-F-SC01, REQ-F-DI05
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoundEndPhase } from '../../../src/components/phases/RoundEndPhase';
import type { RoundScore, Team } from '@tichu/shared';

const roundScore: RoundScore = {
  roundNumber: 3,
  cardPoints: { northSouth: 60, eastWest: 40 },
  tichuBonuses: { northSouth: 100, eastWest: -100 },
  oneTwoBonus: null,
  total: { northSouth: 160, eastWest: -60 },
};

const cumulativeScores: Record<Team, number> = { northSouth: 560, eastWest: 340 };

describe('RoundEndPhase', () => {
  it('REQ-F-SC01: shows round number', () => {
    render(
      <RoundEndPhase roundScore={roundScore} cumulativeScores={cumulativeScores} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('Round 3 Complete')).toBeInTheDocument();
  });

  it('shows card points', () => {
    render(
      <RoundEndPhase roundScore={roundScore} cumulativeScores={cumulativeScores} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('shows tichu bonuses when non-zero', () => {
    render(
      <RoundEndPhase roundScore={roundScore} cumulativeScores={cumulativeScores} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('+100')).toBeInTheDocument();
    expect(screen.getByText('-100')).toBeInTheDocument();
  });

  it('shows 1-2 bonus when present', () => {
    const scoreWith12 = { ...roundScore, oneTwoBonus: 'northSouth' as Team };
    render(
      <RoundEndPhase roundScore={scoreWith12} cumulativeScores={cumulativeScores} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('+200')).toBeInTheDocument();
  });

  it('shows round and cumulative totals', () => {
    render(
      <RoundEndPhase roundScore={roundScore} cumulativeScores={cumulativeScores} onContinue={vi.fn()} />,
    );
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('560')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
  });

  it('calls onContinue when button clicked', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(
      <RoundEndPhase roundScore={roundScore} cumulativeScores={cumulativeScores} onContinue={onContinue} />,
    );
    await user.click(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('has dialog role', () => {
    render(
      <RoundEndPhase roundScore={roundScore} cumulativeScores={cumulativeScores} onContinue={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: /round results/i })).toBeInTheDocument();
  });
});

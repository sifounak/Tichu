// Verifies: REQ-F-DI05, REQ-F-DI04
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScorePanel } from '../../../src/components/game/ScorePanel';
import type { RoundScore, Team } from '@tichu/shared';

const defaultScores: Record<Team, number> = { northSouth: 250, eastWest: 150 };

const roundHistory: RoundScore[] = [
  {
    roundNumber: 1,
    cardPoints: { northSouth: 75, eastWest: 25 },
    tichuBonuses: { northSouth: 100, eastWest: 0 },
    oneTwoBonus: null,
    total: { northSouth: 175, eastWest: 25 },
  },
  {
    roundNumber: 2,
    cardPoints: { northSouth: 50, eastWest: 50 },
    tichuBonuses: { northSouth: 0, eastWest: 0 },
    oneTwoBonus: null,
    total: { northSouth: 75, eastWest: 125 },
  },
];

describe('ScorePanel', () => {
  it('REQ-F-DI05: renders current scores', () => {
    render(
      <ScorePanel scores={defaultScores} roundHistory={[]} tichuCalls={[]} targetScore={1000} />,
    );
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('NS')).toBeInTheDocument();
    expect(screen.getByText('EW')).toBeInTheDocument();
  });

  it('renders target score', () => {
    render(
      <ScorePanel scores={defaultScores} roundHistory={[]} tichuCalls={[]} targetScore={1000} />,
    );
    expect(screen.getByText('First to 1000')).toBeInTheDocument();
  });

  it('REQ-F-DI04: shows tichu call badges', () => {
    const calls = [
      { seat: 'south' as const, call: 'tichu' as const },
      { seat: 'north' as const, call: 'grandTichu' as const },
    ];
    render(
      <ScorePanel scores={defaultScores} roundHistory={[]} tichuCalls={calls} targetScore={1000} />,
    );
    expect(screen.getByText('S: T')).toBeInTheDocument();
    expect(screen.getByText('N: GT')).toBeInTheDocument();
  });

  it('hides tichu calls when none active', () => {
    const calls = [{ seat: 'south' as const, call: 'none' as const }];
    render(
      <ScorePanel scores={defaultScores} roundHistory={[]} tichuCalls={calls} targetScore={1000} />,
    );
    expect(screen.queryByText('S: T')).not.toBeInTheDocument();
  });

  it('shows history toggle button when rounds exist', () => {
    render(
      <ScorePanel scores={defaultScores} roundHistory={roundHistory} tichuCalls={[]} targetScore={1000} />,
    );
    expect(screen.getByText('History (2)')).toBeInTheDocument();
  });

  it('expands round history on toggle click', async () => {
    const user = userEvent.setup();
    render(
      <ScorePanel scores={defaultScores} roundHistory={roundHistory} tichuCalls={[]} targetScore={1000} />,
    );
    await user.click(screen.getByText('History (2)'));
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.getByText('R2')).toBeInTheDocument();
    expect(screen.getByText('175')).toBeInTheDocument();
  });

  it('hides history toggle when no rounds', () => {
    render(
      <ScorePanel scores={defaultScores} roundHistory={[]} tichuCalls={[]} targetScore={1000} />,
    );
    expect(screen.queryByText(/History/)).not.toBeInTheDocument();
  });

  it('has score panel aria-label', () => {
    render(
      <ScorePanel scores={defaultScores} roundHistory={[]} tichuCalls={[]} targetScore={1000} />,
    );
    expect(screen.getByLabelText('Score panel')).toBeInTheDocument();
  });
});

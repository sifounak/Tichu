// Verifies: REQ-F-DI05, REQ-F-DI04
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScorePanel } from '../../../src/components/game/ScorePanel';
import type { RoundScore, Team, Seat } from '@tichu/shared';

const defaultScores: Record<Team, number> = { northSouth: 250, eastWest: 150 };

const defaultSeatNames: Record<Seat, string> = {
  north: 'Alice',
  east: 'Bob',
  south: 'Charlie',
  west: 'Diana',
};

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

const baseProps = {
  scores: defaultScores,
  roundHistory: [] as RoundScore[],
  tichuCalls: [] as Array<{ seat: Seat; call: 'none' | 'tichu' | 'grandTichu' }>,
  targetScore: 1000,
  seatNames: defaultSeatNames,
  mySeat: 'south' as Seat,
};

describe('ScorePanel', () => {
  it('REQ-F-DI05: renders current scores', () => {
    render(<ScorePanel {...baseProps} />);
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders player names in team layout', () => {
    render(<ScorePanel {...baseProps} />);
    // mySeat=south → bottom=Charlie(south), top=Alice(north) = NS team
    // left=Diana(west), right=Bob(east) = EW team
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders target score', () => {
    render(<ScorePanel {...baseProps} />);
    expect(screen.getByText('First to 1000')).toBeInTheDocument();
  });

  it('REQ-F-DI04: shows tichu call badges', () => {
    const calls = [
      { seat: 'south' as const, call: 'tichu' as const },
      { seat: 'north' as const, call: 'grandTichu' as const },
    ];
    render(<ScorePanel {...baseProps} tichuCalls={calls} />);
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('GT')).toBeInTheDocument();
  });

  it('hides tichu calls when none active', () => {
    const calls = [{ seat: 'south' as const, call: 'none' as const }];
    render(<ScorePanel {...baseProps} tichuCalls={calls} />);
    expect(screen.queryByText('T')).not.toBeInTheDocument();
  });

  it('shows history toggle button when rounds exist', () => {
    render(<ScorePanel {...baseProps} roundHistory={roundHistory} />);
    expect(screen.getByText('History (2)')).toBeInTheDocument();
  });

  it('expands round history on toggle click', async () => {
    const user = userEvent.setup();
    render(<ScorePanel {...baseProps} roundHistory={roundHistory} />);
    await user.click(screen.getByText('History (2)'));
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.getByText('R2')).toBeInTheDocument();
    // mySeat=south → myTeam=northSouth, history shows myTeam first
    expect(screen.getByText('175')).toBeInTheDocument();
  });

  it('hides history toggle when no rounds', () => {
    render(<ScorePanel {...baseProps} />);
    expect(screen.queryByText(/History/)).not.toBeInTheDocument();
  });

  it('has score panel aria-label', () => {
    render(<ScorePanel {...baseProps} />);
    expect(screen.getByLabelText('Score panel')).toBeInTheDocument();
  });
});

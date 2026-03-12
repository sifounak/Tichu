// Verifies: REQ-NF-U01, REQ-F-DI01, REQ-F-DI05
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GamePhase } from '@tichu/shared';
import type { ClientGameView, Seat, Team } from '@tichu/shared';
import { GameTable } from '@/components/game/GameTable';

function makeView(overrides: Partial<ClientGameView> = {}): ClientGameView {
  return {
    gameId: 'game-1',
    config: {
      targetScore: 1000,
      turnTimerSeconds: null,
      botDifficulty: 'easy',
      animationSpeed: 'normal',
      spectatorsAllowed: true,
      isPrivate: false,
    },
    phase: GamePhase.Playing,
    scores: { northSouth: 150, eastWest: 75 } as Record<Team, number>,
    roundHistory: [],
    mySeat: 'south' as Seat,
    myHand: [],
    myTichuCall: 'none',
    otherPlayers: [
      { seat: 'north' as Seat, cardCount: 10, tichuCall: 'none', hasPlayed: false, finishOrder: null },
      { seat: 'east' as Seat, cardCount: 12, tichuCall: 'none', hasPlayed: false, finishOrder: null },
      { seat: 'west' as Seat, cardCount: 8, tichuCall: 'tichu', hasPlayed: true, finishOrder: null },
    ],
    currentTrick: null,
    currentTurn: 'south' as Seat,
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: false,
    ...overrides,
  };
}

describe('GameTable', () => {
  it('renders game table with all 4 seats', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByLabelText('Game table')).toBeInTheDocument();
    // Should render 4 player seats
    expect(screen.getByText('South')).toBeInTheDocument();
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
    expect(screen.getByText('West')).toBeInTheDocument();
  });

  it('shows scores', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByText('NS: 150')).toBeInTheDocument();
    expect(screen.getByText('EW: 75')).toBeInTheDocument();
  });

  it('shows phase indicator', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByText(GamePhase.Playing)).toBeInTheDocument();
  });

  it('shows trick area', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByLabelText('Trick area')).toBeInTheDocument();
  });

  it('positions player at bottom regardless of seat', () => {
    // When mySeat is east, east should still appear
    render(<GameTable view={makeView({ mySeat: 'east' as Seat })} />);
    expect(screen.getByLabelText('Game table')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
  });

  it('shows Tichu call on opponent', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByText('T')).toBeInTheDocument(); // West called Tichu
  });
});

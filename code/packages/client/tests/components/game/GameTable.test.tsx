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
  it('renders game table with opponent and partner seats', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByLabelText('Game table')).toBeInTheDocument();
    // 3 seats rendered in grid (partner + 2 opponents); own seat is in page.tsx bottom panel
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
    expect(screen.getByText('West')).toBeInTheDocument();
  });

  it('shows phase indicator', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByText(GamePhase.Playing)).toBeInTheDocument();
  });

  it('shows trick area', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByLabelText('Trick area')).toBeInTheDocument();
  });

  it('positions opponents correctly when mySeat changes', () => {
    // When mySeat is east, other players should be south, north, west
    const eastView = makeView({
      mySeat: 'east' as Seat,
      otherPlayers: [
        { seat: 'south' as Seat, cardCount: 10, tichuCall: 'none', hasPlayed: false, finishOrder: null },
        { seat: 'north' as Seat, cardCount: 12, tichuCall: 'none', hasPlayed: false, finishOrder: null },
        { seat: 'west' as Seat, cardCount: 8, tichuCall: 'none', hasPlayed: false, finishOrder: null },
      ],
    });
    render(<GameTable view={eastView} />);
    expect(screen.getByLabelText('Game table')).toBeInTheDocument();
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('South')).toBeInTheDocument();
    expect(screen.getByText('West')).toBeInTheDocument();
  });

  it('shows Tichu call on opponent', () => {
    render(<GameTable view={makeView()} />);
    expect(screen.getByText('Tichu')).toBeInTheDocument(); // West called Tichu
  });
});

// Verifies: REQ-NF-U01, REQ-F-DI01, REQ-F-DI05
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import { GamePhase } from '@tichu/shared';
import type { ClientGameView, Seat, Team } from '@tichu/shared';
import { GameTable } from '@/components/game/GameTable';

function makeView(overrides: Partial<ClientGameView> = {}): ClientGameView {
  return {
    gameId: 'game-1',
    config: {
      targetScore: 1000,
      turnTimerSeconds: null,
      spectatorsAllowed: true,
      isPrivate: false,
      spectatorChatEnabled: false,
      blindGrandTichuEnabled: false,
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
    dragonGiftedTo: null,
    receivedCards: { north: null, east: null, south: null, west: null } as Record<Seat, import('@tichu/shared').GameCard | null>,
    lastDogPlay: null,
    blindGrandTichuDecided: [],
    grandTichuDecided: [],
    myHasPlayed: false,
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

  it('does not show the play-area timer ring for spectators', () => {
    const now = Date.now();
    const { container } = render(
      <GameTable
        view={makeView({
          turnTimerStartedAt: now,
          turnTimerDurationMs: 30_000,
        })}
        isMyTurn
        isSpectator
      />,
    );

    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows the play-area timer ring for the current seated player', async () => {
    const now = Date.now();
    const { container } = render(
      <GameTable
        view={makeView({
          currentTurn: 'south' as Seat,
          turnTimerStartedAt: now,
          turnTimerDurationMs: 30_000,
        })}
      />,
    );

    await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());
  });

  it('keeps the play-area timer overlay above play-area contents', () => {
    const gameTableCss = readFileSync('src/components/game/GameTable.module.css', 'utf8');

    expect(gameTableCss).toMatch(/\.playAreaTimerOverlay\s*\{[^}]*z-index:\s*3;/s);
    expect(gameTableCss).toMatch(/\.center\s*>\s*:not\(\.playAreaTimerOverlay\)\s*\{/);
  });

  it('keeps the visible play-area border inside the timer target bounds', () => {
    const trickDisplayCss = readFileSync('src/components/game/TrickDisplay.module.css', 'utf8');

    expect(trickDisplayCss).toMatch(/\.playArea\s*\{[^}]*box-sizing:\s*border-box;/s);
  });

  it('does not show the active play-area glow for spectators', () => {
    const { container } = render(
      <GameTable
        view={makeView()}
        isMyTurn
        isSpectator
      />,
    );

    const center = container.querySelector('[data-debug-area="Center / Trick"]');
    expect(center?.className).not.toContain('playAreaActive');
  });

  it('puts the right opponent timer bar on the left side of that seat', () => {
    const now = Date.now();
    const { container } = render(
      <GameTable
        view={makeView({
          currentTurn: 'west' as Seat,
          turnTimerStartedAt: now,
          turnTimerDurationMs: 30_000,
        })}
      />,
    );

    const rightOpponentSeat = container.querySelector('[data-seat="west"]');
    expect(rightOpponentSeat?.className).toContain('timerProgressLeft');
  });
});

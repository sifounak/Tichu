// Verifies: REQ-F-DRA01, REQ-F-DRA02, REQ-F-DRA04, REQ-F-DRA05, REQ-NF-DRA02

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrickDisplay } from '@/components/game/TrickDisplay';
import type { TrickState, Seat } from '@tichu/shared';
import { CombinationType } from '@tichu/shared';

const dragonTrick: TrickState = {
  leadSeat: 'north',
  currentWinner: 'north',
  plays: [
    {
      seat: 'north' as Seat,
      cards: [{ id: 99, card: { kind: 'dragon' as const } }],
      combination: {
        type: CombinationType.Single,
        cards: [{ id: 99, card: { kind: 'dragon' as const } }],
        rank: 16,
        length: 1,
        isBomb: false,
      },
    },
  ],
  passes: ['east', 'south', 'west'] as Seat[],
};

describe('TrickDisplay — Dragon Gift Animation (M3)', () => {
  // REQ-F-DRA01/DRA04: When trick is non-null during dragon gift pending, it renders
  it('renders the trick when dragonGiftPending and trick is present', () => {
    render(
      <TrickDisplay
        trick={dragonTrick}
        mahjongWish={null}
        wishFulfilled={false}
        mySeat="south"
        dragonGiftPending={true}
      />,
    );

    // Dragon gift notification should be visible
    expect(screen.getByText(/must give the Dragon trick/i)).toBeInTheDocument();

    // The trick area should have content (not the empty "Play Area" placeholder)
    expect(screen.queryByText('Play Area')).not.toBeInTheDocument();
  });

  // REQ-F-DRA02: When trick is null but dragonGiftAnimation is active, display the animation trick
  it('renders dragonGiftAnimation trick when store trick is null', () => {
    render(
      <TrickDisplay
        trick={null}
        mahjongWish={null}
        wishFulfilled={false}
        mySeat="south"
        dragonGiftAnimation={{ recipient: 'east', trick: dragonTrick }}
      />,
    );

    // Should NOT show empty "Play Area" — the animation trick keeps it populated
    expect(screen.queryByText('Play Area')).not.toBeInTheDocument();

    // Should show the played cards from the animation trick
    expect(screen.getByLabelText(/north played/)).toBeInTheDocument();
  });

  // REQ-F-DRA05: When both trick and dragonGiftAnimation are null, empty state returns
  it('shows empty play area when both trick and dragonGiftAnimation are null', () => {
    render(
      <TrickDisplay
        trick={null}
        mahjongWish={null}
        wishFulfilled={false}
        mySeat="south"
        dragonGiftAnimation={null}
      />,
    );

    expect(screen.getByText('Play Area')).toBeInTheDocument();
  });

  // REQ-NF-DRA02: When dragonGiftAnimation is not set, behaviour is unchanged
  it('renders normally without dragonGiftAnimation prop', () => {
    render(
      <TrickDisplay
        trick={dragonTrick}
        mahjongWish={null}
        wishFulfilled={false}
        mySeat="south"
      />,
    );

    // Trick content should render
    expect(screen.getByLabelText(/north played/)).toBeInTheDocument();
    expect(screen.queryByText('Play Area')).not.toBeInTheDocument();
  });

  // Verify that when trick is present and dragonGiftAnimation is also set,
  // the real trick takes precedence (displayTrick = trick ?? animation)
  it('prefers store trick over dragonGiftAnimation when both exist', () => {
    const otherTrick: TrickState = {
      leadSeat: 'east',
      currentWinner: 'east',
      plays: [
        {
          seat: 'east' as Seat,
          cards: [{ id: 50, card: { kind: 'standard' as const, suit: 'jade', rank: 14 } }],
          combination: {
            type: CombinationType.Single,
            cards: [{ id: 50, card: { kind: 'standard' as const, suit: 'jade', rank: 14 } }],
            rank: 14,
            length: 1,
            isBomb: false,
          },
        },
      ],
      passes: [],
    };

    render(
      <TrickDisplay
        trick={otherTrick}
        mahjongWish={null}
        wishFulfilled={false}
        mySeat="south"
        dragonGiftAnimation={{ recipient: 'west', trick: dragonTrick }}
      />,
    );

    // Should show the real trick (east played), not the animation trick (north played)
    expect(screen.getByLabelText(/east played/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/north played/)).not.toBeInTheDocument();
  });
});

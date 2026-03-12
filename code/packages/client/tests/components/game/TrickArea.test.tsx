// Verifies: REQ-F-DI06, REQ-F-DI07
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TrickState, Seat } from '@tichu/shared';
import { CombinationType } from '@tichu/shared';
import { TrickArea } from '@/components/game/TrickArea';

describe('TrickArea', () => {
  it('renders empty trick area', () => {
    render(<TrickArea trick={null} mahjongWish={null} wishFulfilled={false} />);
    expect(screen.getByText('Trick Area')).toBeInTheDocument();
  });

  it('renders trick with plays', () => {
    const trick: TrickState = {
      plays: [
        {
          seat: 'south' as Seat,
          combination: { type: CombinationType.Single, cards: [{ id: 0, card: { kind: 'standard', suit: 'jade' as any, rank: 7 as any } }], rank: 7 },
        },
      ],
      passes: [],
      leadSeat: 'south' as Seat,
      currentWinner: 'south' as Seat,
    };
    render(<TrickArea trick={trick} mahjongWish={null} wishFulfilled={false} />);
    expect(screen.getByText('south')).toBeInTheDocument();
  });

  it('shows Mahjong wish indicator when active', () => {
    render(<TrickArea trick={null} mahjongWish={10} wishFulfilled={false} />);
    expect(screen.getByText('Wish: 10')).toBeInTheDocument();
  });

  it('hides wish indicator when fulfilled', () => {
    render(<TrickArea trick={null} mahjongWish={10} wishFulfilled={true} />);
    expect(screen.queryByText('Wish: 10')).not.toBeInTheDocument();
  });

  it('has accessible label on trick area', () => {
    render(<TrickArea trick={null} mahjongWish={null} wishFulfilled={false} />);
    expect(screen.getByLabelText('Trick area')).toBeInTheDocument();
  });
});

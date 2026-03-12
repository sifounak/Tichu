// Verifies: REQ-F-DI06, REQ-F-DI07, REQ-F-DI02
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrickDisplay } from '../../../src/components/game/TrickDisplay';
import type { TrickState, GameCard, Rank, CardId } from '@tichu/shared';
import { CombinationType } from '@tichu/shared';

function makeCard(id: number, rank: Rank, suit = 'jade'): GameCard {
  return { id: id as CardId, card: { kind: 'standard', suit: suit as 'jade', rank } };
}

const singleTrick: TrickState = {
  plays: [
    {
      seat: 'north',
      combination: {
        type: CombinationType.Single,
        cards: [makeCard(0, 7)],
        rank: 7,
        length: 1,
        isBomb: false,
      },
    },
  ],
  passes: [],
  leadSeat: 'north',
  currentWinner: 'north',
};

describe('TrickDisplay', () => {
  it('REQ-F-DI06: renders trick area with aria label', () => {
    render(<TrickDisplay trick={null} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    expect(screen.getByLabelText('Trick area')).toBeInTheDocument();
  });

  it('shows "Lead a card" when no trick is active', () => {
    render(<TrickDisplay trick={null} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    expect(screen.getByText('Lead a card')).toBeInTheDocument();
  });

  it('renders plays when trick has cards', () => {
    render(<TrickDisplay trick={singleTrick} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    expect(screen.getByLabelText(/north played single/i)).toBeInTheDocument();
  });

  it('REQ-F-DI02: highlights the current winner', () => {
    render(<TrickDisplay trick={singleTrick} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    const playGroup = screen.getByLabelText(/north played single/i);
    expect(playGroup.className).toContain('winner');
  });

  it('renders pass indicators', () => {
    const trickWithPasses: TrickState = {
      ...singleTrick,
      passes: ['east'],
    };
    render(<TrickDisplay trick={trickWithPasses} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    expect(screen.getByLabelText(/east passed/i)).toBeInTheDocument();
  });

  it('REQ-F-DI07: shows wish indicator when wish is active', () => {
    render(<TrickDisplay trick={null} mahjongWish={10 as Rank} wishFulfilled={false} mySeat="south" />);
    expect(screen.getByLabelText(/wish for 10/i)).toBeInTheDocument();
    expect(screen.getByText('Wish: 10')).toBeInTheDocument();
  });

  it('hides wish indicator when wish is fulfilled', () => {
    render(<TrickDisplay trick={null} mahjongWish={10 as Rank} wishFulfilled={true} mySeat="south" />);
    expect(screen.queryByLabelText(/wish for 10/i)).not.toBeInTheDocument();
  });

  it('positions plays relative to mySeat', () => {
    render(<TrickDisplay trick={singleTrick} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    // North is my partner (top)
    const playGroup = screen.getByLabelText(/north played single/i);
    expect(playGroup.className).toContain('top');
  });

  it('renders multiple plays in a trick', () => {
    const multiTrick: TrickState = {
      plays: [
        {
          seat: 'north',
          combination: { type: CombinationType.Single, cards: [makeCard(0, 5)], rank: 5, length: 1, isBomb: false },
        },
        {
          seat: 'east',
          combination: { type: CombinationType.Single, cards: [makeCard(1, 8)], rank: 8, length: 1, isBomb: false },
        },
      ],
      passes: [],
      leadSeat: 'north',
      currentWinner: 'east',
    };
    render(<TrickDisplay trick={multiTrick} mahjongWish={null} wishFulfilled={false} mySeat="south" />);
    expect(screen.getByLabelText(/north played single/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/east played single/i)).toBeInTheDocument();
  });
});

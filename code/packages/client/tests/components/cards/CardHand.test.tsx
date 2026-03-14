// Verifies: REQ-F-HV07, REQ-NF-U04
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suit } from '@tichu/shared';
import type { GameCard } from '@tichu/shared';
import { CardHand } from '@/components/cards/CardHand';

function makeCards(count: number): GameCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    card: { kind: 'standard' as const, suit: Suit.Jade, rank: (2 + i) as GameCard['card'] extends { rank: infer R } ? R : never },
  })) as GameCard[];
}

describe('CardHand', () => {
  it('renders all cards in hand', () => {
    const cards = makeCards(5);
    render(<CardHand cards={cards} selectedIds={new Set()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('renders cards sorted by sort key', () => {
    // Mix a phoenix in with standard cards
    const cards: GameCard[] = [
      { id: 0, card: { kind: 'standard', suit: Suit.Star, rank: 14 } } as GameCard,
      { id: 1, card: { kind: 'phoenix' } } as GameCard,
      { id: 2, card: { kind: 'standard', suit: Suit.Jade, rank: 2 } } as GameCard,
    ];
    render(<CardHand cards={cards} selectedIds={new Set()} />);
    const buttons = screen.getAllByRole('button');
    // Sorted order ascending (left to right): Jade 2, Star A, Phoenix
    expect(buttons[0]).toHaveAttribute('data-card-id', '2');
    expect(buttons[1]).toHaveAttribute('data-card-id', '0');
    expect(buttons[2]).toHaveAttribute('data-card-id', '1');
  });

  it('marks selected cards', () => {
    const cards = makeCards(3);
    render(<CardHand cards={cards} selectedIds={new Set([1])} />);
    const buttons = screen.getAllByRole('button');
    const selectedButton = buttons.find((b) => b.getAttribute('data-card-id') === '1');
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not disable any cards (no greying out)', () => {
    const cards = makeCards(3);
    render(<CardHand cards={cards} selectedIds={new Set()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => expect(b).not.toBeDisabled());
  });

  it('calls onCardClick with card id', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const cards = makeCards(3);
    render(<CardHand cards={cards} selectedIds={new Set()} onCardClick={onClick} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders face-down cards when faceDown is true', () => {
    const cards = makeCards(3);
    render(<CardHand cards={cards} selectedIds={new Set()} faceDown />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('aria-label', 'Face-down card');
    }
  });

  it('renders 14-card hand correctly', () => {
    const cards = makeCards(14);
    render(<CardHand cards={cards} selectedIds={new Set()} />);
    expect(screen.getAllByRole('button')).toHaveLength(14);
  });

  it('has aria-label on hand container', () => {
    render(<CardHand cards={[]} selectedIds={new Set()} />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Your hand');
  });
});

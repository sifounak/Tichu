// Verifies: REQ-F-DI01, REQ-F-HV07, REQ-F-HV09, REQ-NF-U04
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suit } from '@tichu/shared';
import type { GameCard } from '@tichu/shared';
import { Card } from '@/components/cards/Card';

function makeStandardCard(rank: number, suit: Suit, id: number): GameCard {
  return {
    id,
    card: { kind: 'standard', suit, rank: rank as GameCard['card'] extends { rank: infer R } ? R : never },
  } as GameCard;
}

function makeSpecialCard(kind: 'dragon' | 'phoenix' | 'mahjong' | 'dog', id: number): GameCard {
  return { id, card: { kind } } as GameCard;
}

describe('Card component', () => {
  describe('rendering', () => {
    it('renders a standard card with rank and suit', () => {
      const card = makeStandardCard(14, Suit.Jade, 0);
      render(<Card gameCard={card} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByLabelText('A of jade')).toBeInTheDocument();
    });

    it('renders all special cards', () => {
      for (const kind of ['dragon', 'phoenix', 'mahjong', 'dog'] as const) {
        const { unmount } = render(<Card gameCard={makeSpecialCard(kind, 52)} />);
        const name = kind.charAt(0).toUpperCase() + kind.slice(1);
        expect(screen.getByLabelText(name)).toBeInTheDocument();
        unmount();
      }
    });

    it('renders face-down card when no gameCard provided', () => {
      render(<Card />);
      expect(screen.getByLabelText('Face-down card')).toBeInTheDocument();
    });

    it('renders face-down when state is faceDown', () => {
      const card = makeStandardCard(5, Suit.Star, 1);
      render(<Card gameCard={card} state="faceDown" />);
      // Face-down with a gameCard still uses the card's label for accessibility
      const btn = screen.getByRole('button');
      expect(btn).toBeInTheDocument();
      expect(btn.querySelector('[class*="back"]')).toBeTruthy();
    });
  });

  describe('states', () => {
    it('applies selected state with aria-pressed', () => {
      const card = makeStandardCard(10, Suit.Pagoda, 5);
      render(<Card gameCard={card} state="selected" />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('disabled card has disabled attribute', () => {
      const card = makeStandardCard(3, Suit.Sword, 10);
      render(<Card gameCard={card} state="disabled" />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('normal card is not disabled', () => {
      const card = makeStandardCard(7, Suit.Jade, 15);
      render(<Card gameCard={card} state="normal" />);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  describe('interaction', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const card = makeStandardCard(9, Suit.Star, 20);
      render(<Card gameCard={card} onClick={onClick} />);
      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const card = makeStandardCard(9, Suit.Star, 20);
      render(<Card gameCard={card} state="disabled" onClick={onClick} />);
      // Disabled buttons don't fire click events in testing-library
      await user.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('all 56 cards render', () => {
    const suits = [Suit.Jade, Suit.Pagoda, Suit.Star, Suit.Sword];
    const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    let id = 0;

    it('renders all 52 standard cards', () => {
      for (const suit of suits) {
        for (const rank of ranks) {
          const card = makeStandardCard(rank, suit, id++);
          const { unmount } = render(<Card gameCard={card} />);
          expect(screen.getByRole('button')).toBeInTheDocument();
          unmount();
        }
      }
    });

    it('renders all 4 special cards', () => {
      for (const kind of ['dragon', 'phoenix', 'mahjong', 'dog'] as const) {
        const card = makeSpecialCard(kind, id++);
        const { unmount } = render(<Card gameCard={card} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
        unmount();
      }
    });
  });
});

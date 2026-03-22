// REQ-F-BOT02: RegularBot implementation — random valid moves

import type { GameCard, Seat, Rank } from '@tichu/shared';
import { isPhoenix } from '@tichu/shared';
import type {
  BotStrategy,
  BotPlayContext,
  BotPlayDecision,
} from './bot-interface.js';
import { selectPassCards } from './bot-strategy-utils.js';

/**
 * REQ-F-BOT02: RegularBot — plays randomly from valid moves.
 *
 * - Grand Tichu: always pass
 * - Regular Tichu: always pass
 * - Card passing: random cards (1 to each other player)
 * - Play: random valid combination from getValidPlays(), or pass if allowed
 * - Dragon gift: random opponent
 * - Mahjong wish: null (no wish)
 */
export class RegularBot implements BotStrategy {
  readonly difficulty = 'regular' as const;

  chooseGrandTichu(_hand8: GameCard[]): boolean {
    return false;
  }

  chooseRegularTichu(_hand14: GameCard[]): boolean {
    return false;
  }

  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard> {
    return selectPassCards(hand, seat);
  }

  choosePlay(context: BotPlayContext): BotPlayDecision {
    const { validPlays, canPass } = context;

    // If no valid plays, must pass
    if (validPlays.length === 0) {
      return { action: 'pass' };
    }

    // Randomly decide to pass (30% chance) when allowed and there are plays
    if (canPass && Math.random() < 0.3) {
      return { action: 'pass' };
    }

    // Pick a random valid play
    const chosen = validPlays[Math.floor(Math.random() * validPlays.length)];

    // If the combination uses Phoenix with a resolved value, include phoenixAs
    const phoenixCard = chosen.cards.find((gc) => isPhoenix(gc.card));
    let phoenixAs: Rank | undefined;
    if (phoenixCard && chosen.phoenixUsedAs !== undefined) {
      phoenixAs = chosen.phoenixUsedAs as Rank;
    }

    return {
      action: 'play',
      cards: chosen.cards,
      phoenixAs,
    };
  }

  chooseDragonGiftRecipient(opponents: Seat[], _trickPoints: number): Seat {
    return opponents[Math.floor(Math.random() * opponents.length)];
  }

  chooseMahjongWish(_hand: GameCard[]): Rank | null {
    return null;
  }
}

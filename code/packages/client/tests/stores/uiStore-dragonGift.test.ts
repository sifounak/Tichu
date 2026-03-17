// Verifies: REQ-F-DRA02, REQ-F-DRA03, REQ-NF-DRA01, REQ-NF-DRA02

import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/stores/uiStore';
import type { TrickState, Seat } from '@tichu/shared';
import { CombinationType } from '@tichu/shared';

const mockTrick: TrickState = {
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

describe('uiStore — Dragon Gift Animation (REQ-F-DRA02)', () => {
  beforeEach(() => {
    useUiStore.setState({ dragonGiftAnimation: null });
  });

  it('initialises dragonGiftAnimation as null', () => {
    expect(useUiStore.getState().dragonGiftAnimation).toBeNull();
  });

  it('startDragonGiftAnimation sets recipient and trick', () => {
    useUiStore.getState().startDragonGiftAnimation('east', mockTrick);

    const state = useUiStore.getState().dragonGiftAnimation;
    expect(state).not.toBeNull();
    expect(state!.recipient).toBe('east');
    expect(state!.trick).toBe(mockTrick);
  });

  it('clearDragonGiftAnimation resets to null', () => {
    useUiStore.getState().startDragonGiftAnimation('west', mockTrick);
    expect(useUiStore.getState().dragonGiftAnimation).not.toBeNull();

    useUiStore.getState().clearDragonGiftAnimation();
    expect(useUiStore.getState().dragonGiftAnimation).toBeNull();
  });

  it('can overwrite an existing animation with a new one', () => {
    useUiStore.getState().startDragonGiftAnimation('east', mockTrick);
    useUiStore.getState().startDragonGiftAnimation('west', mockTrick);

    expect(useUiStore.getState().dragonGiftAnimation!.recipient).toBe('west');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { TurnTimer } from '../../src/game/turn-timer.js';
import type { TimerSnapshot } from '../../src/game/game-serializer.js';

describe('TurnTimer serialization', () => {
  it('returns null snapshot when timer is disabled', () => {
    const timer = new TurnTimer(null, vi.fn());
    expect(timer.serialize()).toBeNull();
    timer.dispose();
  });

  it('returns null snapshot when timer is not active', () => {
    const timer = new TurnTimer(30, vi.fn());
    expect(timer.serialize()).toBeNull();
    timer.dispose();
  });

  it('captures active timer state', () => {
    const timer = new TurnTimer(30, vi.fn());
    timer.start('north');
    const snapshot = timer.serialize();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.currentSeat).toBe('north');
    expect(snapshot!.durationMs).toBe(30000);
    expect(typeof snapshot!.startTime).toBe('number');
    timer.dispose();
  });

  it('restores with correct duration', () => {
    const onTimeout = vi.fn();
    const snapshot: TimerSnapshot = {
      currentSeat: 'east',
      startTime: Date.now() - 5000,
      durationMs: 30000,
    };
    const restored = TurnTimer.restore(snapshot, onTimeout);
    expect(restored.isEnabled()).toBe(true);
    expect(restored.getDurationMs()).toBe(30000);
    // Timer is NOT started on restore — caller starts it explicitly
    expect(restored.isActive()).toBe(false);
    restored.dispose();
  });
});

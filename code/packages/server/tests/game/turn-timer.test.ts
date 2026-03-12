// Verifies: REQ-F-MP09

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TurnTimer } from '../../src/game/turn-timer.js';
import type { Seat } from '@tichu/shared';

describe('TurnTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Verifies: REQ-F-MP09
  it('fires timeout callback after configured duration', () => {
    const onTimeout = vi.fn();
    const timer = new TurnTimer(30, onTimeout);

    timer.start('north');
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(onTimeout).toHaveBeenCalledWith('north');
    expect(onTimeout).toHaveBeenCalledTimes(1);

    timer.dispose();
  });

  it('does not fire if stopped before timeout', () => {
    const onTimeout = vi.fn();
    const timer = new TurnTimer(30, onTimeout);

    timer.start('east');
    vi.advanceTimersByTime(15_000);
    timer.stop();
    vi.advanceTimersByTime(20_000);

    expect(onTimeout).not.toHaveBeenCalled();
    timer.dispose();
  });

  it('restarts timer when start is called again', () => {
    const onTimeout = vi.fn();
    const timer = new TurnTimer(10, onTimeout);

    timer.start('north');
    vi.advanceTimersByTime(8_000);

    // Restart for a different player
    timer.start('south');
    vi.advanceTimersByTime(8_000);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);
    expect(onTimeout).toHaveBeenCalledWith('south');

    timer.dispose();
  });

  it('does nothing when timer is disabled (null duration)', () => {
    const onTimeout = vi.fn();
    const timer = new TurnTimer(null, onTimeout);

    timer.start('north');
    vi.advanceTimersByTime(100_000);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(timer.isActive()).toBe(false);
    expect(timer.isEnabled()).toBe(false);

    timer.dispose();
  });

  it('reports correct current seat', () => {
    const timer = new TurnTimer(30, vi.fn());

    expect(timer.getCurrentSeat()).toBeNull();

    timer.start('west');
    expect(timer.getCurrentSeat()).toBe('west');

    timer.stop();
    expect(timer.getCurrentSeat()).toBeNull();

    timer.dispose();
  });

  it('reports active status correctly', () => {
    const timer = new TurnTimer(30, vi.fn());

    expect(timer.isActive()).toBe(false);

    timer.start('north');
    expect(timer.isActive()).toBe(true);

    timer.stop();
    expect(timer.isActive()).toBe(false);

    timer.dispose();
  });

  it('reports enabled status correctly', () => {
    const enabledTimer = new TurnTimer(30, vi.fn());
    expect(enabledTimer.isEnabled()).toBe(true);
    enabledTimer.dispose();

    const disabledTimer = new TurnTimer(null, vi.fn());
    expect(disabledTimer.isEnabled()).toBe(false);
    disabledTimer.dispose();
  });

  it('reports remaining time', () => {
    const timer = new TurnTimer(30, vi.fn());

    expect(timer.getRemainingMs()).toBeNull();

    timer.start('north');
    // At start, remaining should be close to 30000
    expect(timer.getRemainingMs()).toBe(30_000);

    vi.advanceTimersByTime(10_000);
    expect(timer.getRemainingMs()).toBe(20_000);

    vi.advanceTimersByTime(20_000);
    // After timeout, remaining should be null
    expect(timer.getRemainingMs()).toBeNull();

    timer.dispose();
  });

  it('clears seat after timeout fires', () => {
    const onTimeout = vi.fn();
    const timer = new TurnTimer(10, onTimeout);

    timer.start('east');
    vi.advanceTimersByTime(10_000);

    expect(timer.getCurrentSeat()).toBeNull();
    expect(timer.isActive()).toBe(false);

    timer.dispose();
  });

  it('dispose stops active timer', () => {
    const onTimeout = vi.fn();
    const timer = new TurnTimer(10, onTimeout);

    timer.start('north');
    timer.dispose();

    vi.advanceTimersByTime(20_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBombWindow } from '../../src/hooks/useBombWindow';
import { useUiStore } from '../../src/stores/uiStore';

describe('useBombWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({
      bombWindowActive: false,
      bombWindowEndTime: null,
      queuedPlay: null,
      selectedCardIds: new Set(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not start the window when disabled', () => {
    const send = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useBombWindow({ send, enabled: false }));

    act(() => {
      result.current.startWindow();
    });

    expect(useUiStore.getState().bombWindowActive).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('flushes a queued play when disabled while active', () => {
    const send = vi.fn().mockReturnValue(true);
    const { result, rerender } = renderHook(
      ({ enabled }) => useBombWindow({ send, enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => {
      result.current.startWindow();
      useUiStore.getState().setQueuedPlay({ cardIds: [1, 2] });
    });

    act(() => {
      rerender({ enabled: false });
    });

    expect(send).toHaveBeenCalledWith({ type: 'PLAY_CARDS', cardIds: [1, 2] });
    expect(useUiStore.getState().bombWindowActive).toBe(false);
    expect(useUiStore.getState().queuedPlay).toBeNull();
  });
});

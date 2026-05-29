import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLayoutTier } from '@/hooks/useLayoutTier';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe('useLayoutTier', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-layout');
  });

  it('uses full layout at 900px and wider', async () => {
    setViewportWidth(900);

    const { result } = renderHook(() => useLayoutTier());

    await waitFor(() => expect(result.current).toBe('full'));
    expect(document.documentElement.getAttribute('data-layout')).toBe('full');
  });

  it('uses mobile layout below 900px', async () => {
    setViewportWidth(899);

    const { result } = renderHook(() => useLayoutTier());

    await waitFor(() => expect(result.current).toBe('mobile'));
    expect(document.documentElement.getAttribute('data-layout')).toBe('mobile');
  });
});

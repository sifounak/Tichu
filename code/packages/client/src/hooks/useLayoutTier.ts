'use client';

import { useState, useEffect } from 'react';

// REQ-F-L01: Two-tier layout system
export type LayoutTier = 'full' | 'mobile';

// REQ-F-L02: Breakpoint at 900px
const FULL_MIN_WIDTH = 900;

function getTier(width: number): LayoutTier {
  return width >= FULL_MIN_WIDTH ? 'full' : 'mobile';
}

/**
 * Returns the current layout tier based on window width and sets
 * a data-layout attribute on :root for CSS targeting.
 *
 * Tiers:
 *  - 'full'   (≥900px): CSS grid card-table layout
 *  - 'mobile' (<900px): flexbox column layout
 */
export function useLayoutTier(): LayoutTier {
  const [tier, setTier] = useState<LayoutTier>('full');

  useEffect(() => {
    function update() {
      const next = getTier(window.innerWidth);
      setTier(next);
      document.documentElement.setAttribute('data-layout', next);
    }

    update();

    const mq = window.matchMedia(`(max-width: ${FULL_MIN_WIDTH - 1}px)`);

    function onChange() {
      update();
    }

    mq.addEventListener('change', onChange);

    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  return tier;
}

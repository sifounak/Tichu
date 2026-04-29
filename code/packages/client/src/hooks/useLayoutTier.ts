'use client';

import { useState, useEffect } from 'react';

export type LayoutTier = 'full' | 'compact' | 'mobile';

const FULL_MIN_WIDTH = 1100;
const COMPACT_MIN_WIDTH = 700;

function getTier(width: number): LayoutTier {
  if (width > FULL_MIN_WIDTH) return 'full';
  if (width >= COMPACT_MIN_WIDTH) return 'compact';
  return 'mobile';
}

/**
 * Returns the current layout tier based on window width and sets
 * a data-layout attribute on :root for CSS targeting.
 *
 * Tiers:
 *  - 'full'    (>1100px): original card-table layout, no changes
 *  - 'compact' (700–1100px): two-row opponents, chrome row
 *  - 'mobile'  (<700px): same as compact, scaled smaller
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

    const mqFull = window.matchMedia(`(max-width: ${FULL_MIN_WIDTH}px)`);
    const mqCompact = window.matchMedia(`(max-width: ${COMPACT_MIN_WIDTH}px)`);

    function onChange() {
      update();
    }

    mqFull.addEventListener('change', onChange);
    mqCompact.addEventListener('change', onChange);

    return () => {
      mqFull.removeEventListener('change', onChange);
      mqCompact.removeEventListener('change', onChange);
    };
  }, []);

  return tier;
}

'use client';

import { useEffect } from 'react';

/** Scale parameters per layout tier.
 *
 * REQ-F-L09, REQ-F-L10: Two-tier scale config.
 *
 * Mobile uses a "fixed then scale" approach:
 *   - Elements stay at scale=1.0 (their natural size at the breakpoint entry)
 *   - Flexbox compresses whitespace as the window narrows
 *   - Scaling only kicks in below `scaleBelow` to prevent overlap
 *   - Formula: min(1.0, innerWidth / scaleBelow), clamped to [min, 1.0]
 */
const TIER_CONFIG = {
  full:   { ref: 1200, min: 0.5, max: 2.0, useMin: true,  scaleBelow: 0 },
  mobile: { ref: 900,  min: 0.55, max: 1.0, useMin: false, scaleBelow: 700 },
} as const;

/**
 * Sets a --scale CSS custom property on :root based on window size and layout tier.
 *
 * Full tier:   min(innerWidth, innerHeight) / 1200, clamped [0.5, 2.0]
 * Mobile tier: 1.0 when width >= 700, then innerWidth/700 down to 0.55
 */
export function useScaleFactor(): void {
  useEffect(() => {
    let rafId: number | null = null;

    function updateScale() {
      const tier = (document.documentElement.getAttribute('data-layout') ?? 'full') as keyof typeof TIER_CONFIG;
      const config = TIER_CONFIG[tier] ?? TIER_CONFIG.full;

      let raw: number;
      if (config.scaleBelow > 0) {
        // Compact/mobile: stay at 1.0 until width drops below threshold, then scale
        raw = Math.min(1.0, window.innerWidth / config.scaleBelow);
      } else {
        // Full: original proportional scaling
        const basis = config.useMin
          ? Math.min(window.innerWidth, window.innerHeight)
          : window.innerWidth;
        raw = basis / config.ref;
      }

      const scale = Math.min(config.max, Math.max(config.min, raw));
      document.documentElement.style.setProperty('--scale', scale.toString());
    }

    function onResize() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateScale();
        rafId = null;
      });
    }

    // Set initial value immediately
    updateScale();

    window.addEventListener('resize', onResize);

    // Also recalculate when data-layout changes
    const observer = new MutationObserver(() => updateScale());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-layout'],
    });

    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);
}

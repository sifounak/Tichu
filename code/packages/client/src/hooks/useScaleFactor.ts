'use client';

import { useEffect } from 'react';

const REFERENCE_SIZE = 1200;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

/**
 * Sets a --scale CSS custom property on :root based on window size.
 * Reference: 1200x1200px → scale = 1.0
 * Scale = min(innerWidth, innerHeight) / 1200, clamped to [0.5, 2.0].
 */
export function useScaleFactor(): void {
  useEffect(() => {
    let rafId: number | null = null;

    function updateScale() {
      const raw = Math.min(window.innerWidth, window.innerHeight) / REFERENCE_SIZE;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
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
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);
}

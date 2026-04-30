'use client';

import { useEffect } from 'react';

/**
 * Toggles a CSS debug outline on all elements via Ctrl+Shift+D.
 * Temporary dev tool — remove when no longer needed.
 */
export function DebugOutlines() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        document.documentElement.classList.toggle('debug-outlines');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}

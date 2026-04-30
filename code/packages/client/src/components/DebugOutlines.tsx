'use client';

import { useEffect } from 'react';

const EDGE_THRESHOLD = 8; // px from element edge to trigger highlight

/**
 * Toggles a CSS debug outline on all elements via Ctrl+Shift+D.
 * When active, hovering near an element's outline edge raises its label.
 * Temporary dev tool — remove when no longer needed.
 */
export function DebugOutlines() {
  useEffect(() => {
    let currentHighlight: Element | null = null;

    function clearHighlight() {
      if (currentHighlight) {
        currentHighlight.classList.remove('debug-edge-hover');
        currentHighlight = null;
      }
    }

    /** Returns true if (x, y) is within threshold of the element's edge but not deep inside */
    function isNearEdge(el: Element, x: number, y: number): boolean {
      const r = el.getBoundingClientRect();
      const insideX = x >= r.left && x <= r.right;
      const insideY = y >= r.top && y <= r.bottom;
      const nearLeft = Math.abs(x - r.left) <= EDGE_THRESHOLD;
      const nearRight = Math.abs(x - r.right) <= EDGE_THRESHOLD;
      const nearTop = Math.abs(y - r.top) <= EDGE_THRESHOLD;
      const nearBottom = Math.abs(y - r.bottom) <= EDGE_THRESHOLD;

      // Near a vertical edge and vertically within the element (or near corner)
      if ((nearLeft || nearRight) && (insideY || nearTop || nearBottom)) return true;
      // Near a horizontal edge and horizontally within the element (or near corner)
      if ((nearTop || nearBottom) && (insideX || nearLeft || nearRight)) return true;
      return false;
    }

    function onMouseMove(e: MouseEvent) {
      if (!document.documentElement.classList.contains('debug-outlines')) return;

      const elements = document.querySelectorAll('[data-debug-area]');
      // Check in reverse DOM order so topmost (last) elements win
      let found: Element | null = null;
      for (let i = elements.length - 1; i >= 0; i--) {
        if (isNearEdge(elements[i], e.clientX, e.clientY)) {
          found = elements[i];
          break;
        }
      }

      if (found !== currentHighlight) {
        clearHighlight();
        if (found) {
          found.classList.add('debug-edge-hover');
          currentHighlight = found;
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        document.documentElement.classList.toggle('debug-outlines');
        clearHighlight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', onMouseMove);
      clearHighlight();
    };
  }, []);

  return null;
}

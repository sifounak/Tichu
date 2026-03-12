// REQ-NF-U03: Keyboard navigation — roving tabindex for card hand
'use client';

import { useCallback, useRef } from 'react';

export function useRovingTabIndex(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (itemCount === 0) return;
      const container = containerRef.current;
      if (!container) return;

      const buttons = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[data-card-id]'),
      );
      const currentIndex = buttons.findIndex((b) => b === document.activeElement);
      if (currentIndex < 0) return;

      let nextIndex = -1;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % buttons.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = buttons.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      buttons[nextIndex]?.focus();
    },
    [itemCount],
  );

  return { containerRef, handleKeyDown };
}

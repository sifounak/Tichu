// REQ-NF-U02: Score tally — animated number counter
'use client';

import { memo, useEffect, useState, useRef } from 'react';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';

export interface AnimatedScoreProps {
  value: number;
  className?: string;
}

export const AnimatedScore = memo(function AnimatedScore({ value, className }: AnimatedScoreProps) {
  const { durations, enabled } = useAnimationSettings();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;

    if (!enabled || from === value) {
      setDisplay(value);
      return;
    }

    const duration = durations.scoreTally * 1000;
    const start = performance.now();
    const diff = value - from;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [value, enabled, durations.scoreTally]);

  return <span className={className}>{display}</span>;
});

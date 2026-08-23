// REQ-F-TT02: Depleting SVG border ring for active turn surfaces
'use client';

import { memo, useLayoutEffect, useState, type RefObject } from 'react';
import type { TimerStage } from '@/hooks/useTurnTimer';
import styles from './TurnTimer.module.css';

export interface TurnTimerProps {
  remainingSeconds: number;
  totalSeconds: number;
  stage: TimerStage;
  targetRef: RefObject<HTMLDivElement | null>;
}

function buildRingPath(w: number, h: number, r: number, inset: number): { d: string; perimeter: number } {
  const x = inset;
  const y = inset;
  const iw = w - 2 * inset;
  const ih = h - 2 * inset;
  const cx = x + iw / 2;
  const cr = Math.min(r, iw / 2, ih / 2);

  const d = [
    `M ${cx},${y}`,
    `H ${x + cr}`,
    `A ${cr},${cr} 0 0,0 ${x},${y + cr}`,
    `V ${y + ih - cr}`,
    `A ${cr},${cr} 0 0,0 ${x + cr},${y + ih}`,
    `H ${x + iw - cr}`,
    `A ${cr},${cr} 0 0,0 ${x + iw},${y + ih - cr}`,
    `V ${y + cr}`,
    `A ${cr},${cr} 0 0,0 ${x + iw - cr},${y}`,
    `H ${cx}`,
  ].join(' ');

  const straightTop = iw - 2 * cr;
  const straightSides = 2 * (ih - 2 * cr);
  const straightBottom = iw - 2 * cr;
  const arcs = 2 * Math.PI * cr;
  const perimeter = straightTop + straightSides + straightBottom + arcs;

  return { d, perimeter };
}

export const TurnTimer = memo(function TurnTimer({
  remainingSeconds,
  totalSeconds,
  stage,
  targetRef,
}: TurnTimerProps) {
  const [dims, setDims] = useState<{ w: number; h: number; radius: number; strokeWidth: number } | null>(null);

  useLayoutEffect(() => {
    let observer: ResizeObserver | null = null;
    let frameId: number | null = null;
    let cancelled = false;

    const schedule = (callback: () => void) => {
      frameId = window.requestAnimationFrame(callback);
    };

    const attach = () => {
      if (cancelled) return;
      const el = targetRef.current;
      if (!el) {
        schedule(attach);
        return;
      }

      const measure = () => {
        if (cancelled) return;
        const styles = getComputedStyle(el);
        const scale = Number.parseFloat(styles.getPropertyValue('--scale')) || 1;
        setDims({
          w: el.offsetWidth,
          h: el.offsetHeight,
          radius: Number.parseFloat(styles.borderTopLeftRadius) || 0,
          strokeWidth: 6 * scale,
        });
      };

      measure();
      observer = new ResizeObserver(measure);
      observer.observe(el);
    };

    attach();

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
    };
  }, [targetRef]);

  if (!dims || totalSeconds <= 0) return null;

  const halfStroke = dims.strokeWidth / 2;
  const { d, perimeter } = buildRingPath(
    dims.w,
    dims.h,
    Math.max(0, dims.radius - halfStroke),
    halfStroke,
  );
  const ratio = Math.min(1, Math.max(0, remainingSeconds / totalSeconds));
  const visible = ratio * perimeter;

  return (
    <svg
      className={`${styles.ring} ${styles[stage]}`}
      width={dims.w}
      height={dims.h}
      viewBox={`0 0 ${dims.w} ${dims.h}`}
      aria-hidden="true"
    >
      <path d={d} className={styles.track} />
      <path
        d={d}
        className={styles.active}
        strokeDasharray={`${visible} ${perimeter - visible}`}
      />
    </svg>
  );
});

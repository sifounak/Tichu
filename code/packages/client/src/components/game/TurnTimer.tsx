// REQ-F-TT02: Depleting SVG border ring around PlayerSeat
'use client';

import { memo, useLayoutEffect, useState, type RefObject } from 'react';
import type { TimerStage } from '@/hooks/useTurnTimer';
import styles from './TurnTimer.module.css';

export interface TurnTimerProps {
  remainingSeconds: number;
  totalSeconds: number;
  stage: TimerStage;
  /** Ref to the parent .seat div for measuring dimensions */
  seatRef: RefObject<HTMLDivElement | null>;
}

/**
 * REQ-F-TT02: Build a counter-clockwise rounded-rectangle SVG path
 * starting from top-center. The path goes: top-center → left along top →
 * top-left arc → down left side → bottom-left arc → right along bottom →
 * bottom-right arc → up right side → top-right arc → back to top-center.
 */
function buildRingPath(w: number, h: number, r: number, inset: number): { d: string; perimeter: number } {
  const x = inset;
  const y = inset;
  const iw = w - 2 * inset;
  const ih = h - 2 * inset;
  const cx = x + iw / 2; // top center X

  // Clamp radius to half the smallest dimension
  const cr = Math.min(r, iw / 2, ih / 2);

  // Counter-clockwise from top center
  const d = [
    `M ${cx},${y}`,
    // Left along top
    `H ${x + cr}`,
    // Top-left arc (counter-clockwise = sweep-flag 0)
    `A ${cr},${cr} 0 0,0 ${x},${y + cr}`,
    // Down left side
    `V ${y + ih - cr}`,
    // Bottom-left arc
    `A ${cr},${cr} 0 0,0 ${x + cr},${y + ih}`,
    // Right along bottom
    `H ${x + iw - cr}`,
    // Bottom-right arc
    `A ${cr},${cr} 0 0,0 ${x + iw},${y + ih - cr}`,
    // Up right side
    `V ${y + cr}`,
    // Top-right arc
    `A ${cr},${cr} 0 0,0 ${x + iw - cr},${y}`,
    // Back to top center
    `H ${cx}`,
  ].join(' ');

  // Total perimeter: 4 straight edges + 4 quarter-circle arcs
  const straightTop = iw - 2 * cr;
  const straightSides = 2 * (ih - 2 * cr);
  const straightBottom = iw - 2 * cr;
  const arcs = 4 * (Math.PI * cr / 2);
  const perimeter = straightTop + straightSides + straightBottom + arcs;

  return { d, perimeter };
}

export const TurnTimer = memo(function TurnTimer({
  remainingSeconds,
  totalSeconds,
  stage,
  seatRef,
}: TurnTimerProps) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = seatRef.current;
    if (!el) return;

    const measure = () => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [seatRef]);

  if (!dims || totalSeconds <= 0) return null;

  // The inset value matches the CSS inset: calc(-5px * var(--scale))
  // We draw the ring at a 5px offset from the seat edges
  const padding = 5;
  const svgW = dims.w + padding * 2;
  const svgH = dims.h + padding * 2;

  // Match seat border-radius: var(--space-3) = 12px (before scaling)
  // The actual rendered radius includes the padding offset
  const borderRadius = 12 + padding;

  const { d, perimeter } = buildRingPath(svgW, svgH, borderRadius, 3);
  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const visible = ratio * perimeter;

  return (
    <svg
      className={`${styles.ring} ${styles[stage]}`}
      viewBox={`0 0 ${svgW} ${svgH}`}
      aria-hidden="true"
    >
      {/* Dim track (full ring outline) */}
      <path d={d} className={styles.track} />
      {/* Active ring (depleting portion) */}
      <path
        d={d}
        className={styles.active}
        strokeDasharray={`${visible} ${perimeter - visible}`}
      />
    </svg>
  );
});

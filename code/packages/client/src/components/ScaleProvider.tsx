'use client';

import { useScaleFactor } from '@/hooks/useScaleFactor';

export function ScaleProvider({ children }: { children: React.ReactNode }) {
  useScaleFactor();
  return <>{children}</>;
}

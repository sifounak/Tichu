// REQ-F-BB01: Block browser back/forward navigation with confirmation dialog
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseNavigationBlockOptions {
  enabled: boolean;
}

interface UseNavigationBlockResult {
  dialogOpen: boolean;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
}

// Type for the Navigation API (Chrome/Edge 102+)
interface NavigationEvent extends Event {
  navigationType: string;
  preventDefault: () => void;
}

export function useNavigationBlock({ enabled }: UseNavigationBlockOptions): UseNavigationBlockResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const blockedRef = useRef(enabled);
  const guardPushedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    blockedRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Deep-clone the current history state so Next.js mutations don't corrupt it
    const clonedState = structuredClone(window.history.state);
    const currentUrl = window.location.href;

    // Push a sacrificial guard entry at the same URL.
    // When the user presses back, the browser pops THIS entry (not the real previous page),
    // keeping the URL unchanged and giving us a popstate event to intercept.
    const guardState = { ...clonedState, __TICHU_GUARD: true };
    window.history.pushState(guardState, '', currentUrl);
    guardPushedRef.current = true;

    const pushGuard = () => {
      window.history.pushState(guardState, '', currentUrl);
      guardPushedRef.current = true;
    };

    // Arm after a short delay so Strict Mode's cleanup go(-1) settles before
    // listeners start reacting. Without this, the async history.go(-1) from
    // cleanup fires into the newly-mounted listeners and opens the dialog
    // immediately on mount.
    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 50);

    // --- Layer 1: Navigation API (Chrome/Edge 102+) ---
    let removeNavigationListener: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = (window as any).navigation as EventTarget | undefined;
    if (nav && typeof nav.addEventListener === 'function') {
      const handleNavigate = (e: Event) => {
        const navEvent = e as NavigationEvent;
        if (navEvent.navigationType !== 'traverse' || !blockedRef.current || !armed) return;
        navEvent.preventDefault();
        setDialogOpen(true);
      };
      nav.addEventListener('navigate', handleNavigate);
      removeNavigationListener = () => nav.removeEventListener('navigate', handleNavigate);
    }

    // --- Layer 2: Capture-phase popstate (Firefox/Safari fallback) ---
    const handlePopState = (e: PopStateEvent) => {
      if (!blockedRef.current || !armed) return;

      // The guard was popped. Block the event and re-push the guard.
      e.stopImmediatePropagation();
      pushGuard();
      setDialogOpen(true);
    };
    window.addEventListener('popstate', handlePopState, { capture: true });

    // --- Layer 3: pageshow for bfcache restoration ---
    const handlePageShow = (e: PageTransitionEvent) => {
      if (!e.persisted || !blockedRef.current) return;
      // If restored from bfcache, ensure the guard is in place
      if (!guardPushedRef.current) {
        pushGuard();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    // Cleanup function stored in ref so confirmNavigation can call it
    const cleanup = () => {
      clearTimeout(armTimer);
      removeNavigationListener?.();
      window.removeEventListener('popstate', handlePopState, { capture: true });
      window.removeEventListener('pageshow', handlePageShow);
      // Pop the guard entry so normal navigation works
      if (guardPushedRef.current) {
        guardPushedRef.current = false;
        window.history.go(-1);
      }
    };
    cleanupRef.current = cleanup;

    return cleanup;
  }, [enabled]);

  const confirmNavigation = useCallback(() => {
    blockedRef.current = false;
    setDialogOpen(false);
    // Remove listeners and pop guard entry before caller triggers navigation
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const cancelNavigation = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return { dialogOpen, confirmNavigation, cancelNavigation };
}

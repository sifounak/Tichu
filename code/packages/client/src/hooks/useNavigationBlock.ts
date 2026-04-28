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

    // Remove listeners only (no history manipulation).
    // Used by confirmNavigation — callers navigate explicitly via router.push,
    // so calling go(-1) here would race with and undo that navigation.
    const removeListeners = () => {
      clearTimeout(armTimer);
      removeNavigationListener?.();
      window.removeEventListener('popstate', handlePopState, { capture: true });
      window.removeEventListener('pageshow', handlePageShow);
    };
    cleanupRef.current = removeListeners;

    // Full cleanup for effect teardown: remove listeners AND pop the guard entry.
    // Only runs when `enabled` flips to false or the component unmounts — never
    // races with an explicit router.push.
    return () => {
      removeListeners();
      if (guardPushedRef.current) {
        guardPushedRef.current = false;
        window.history.go(-1);
      }
    };
  }, [enabled]);

  const confirmNavigation = useCallback(() => {
    blockedRef.current = false;
    setDialogOpen(false);
    // Remove listeners but do NOT pop the guard entry — the caller will
    // navigate away (router.push) and the guard entry becomes irrelevant.
    // Calling go(-1) here would race with and undo the caller's navigation.
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    guardPushedRef.current = false;
  }, []);

  const cancelNavigation = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return { dialogOpen, confirmNavigation, cancelNavigation };
}

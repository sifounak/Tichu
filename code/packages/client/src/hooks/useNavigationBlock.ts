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

export function useNavigationBlock({ enabled }: UseNavigationBlockOptions): UseNavigationBlockResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const blockedRef = useRef(enabled);

  useEffect(() => {
    blockedRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Capture the current history state (includes Next.js internals: __NA, __PRIVATE_NEXTJS_INTERNALS_TREE)
    // so we can restore it after intercepting a popstate event.
    const savedState = window.history.state;
    const savedUrl = window.location.href;

    const handlePopState = (e: PopStateEvent) => {
      if (!blockedRef.current) return;

      // Stop Next.js's bubble-phase popstate handler from processing this event
      e.stopImmediatePropagation();

      // The browser has already popped the history entry. Re-push the saved game page
      // state to restore the URL and keep the user on this page.
      // savedState contains __NA: true, so Next.js's patched pushState takes the fast
      // path (calls originalPushState directly) without dispatching a React action.
      window.history.pushState(savedState, '', savedUrl);

      setDialogOpen(true);
    };

    // capture: true ensures we fire BEFORE Next.js's bubble-phase listener
    window.addEventListener('popstate', handlePopState, { capture: true });

    return () => {
      window.removeEventListener('popstate', handlePopState, { capture: true });
    };
  }, [enabled]);

  const confirmNavigation = useCallback(() => {
    blockedRef.current = false;
    setDialogOpen(false);
  }, []);

  const cancelNavigation = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return { dialogOpen, confirmNavigation, cancelNavigation };
}

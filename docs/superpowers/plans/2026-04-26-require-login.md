# Require Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make login the home page, require authentication for all routes, and hide guest access UI.

**Architecture:** Client-side AuthGuard component wraps all protected pages. Root page (`/`) becomes the login/register form. The `/login` route is deleted. All `/login` references updated to `/`.

**Tech Stack:** Next.js App Router, React, Zustand (authStore), TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `packages/client/src/components/AuthGuard.tsx` | Reusable auth gate — loading, redirect, or render children |
| Rewrite | `packages/client/src/app/page.tsx` | Login/register form (moved from login/page.tsx) |
| Delete | `packages/client/src/app/login/page.tsx` | Removed entirely |
| Modify | `packages/client/src/app/lobby/page.tsx` | Wrap in AuthGuard, update `/login` refs to `/` |
| Modify | `packages/client/src/app/game/[gameId]/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/leaderboard/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/profile/page.tsx` | Wrap in AuthGuard, update `/login` ref to `/` |
| Modify | `packages/client/src/app/stats/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/stats/cards/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/stats/history/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/stats/players/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/stats/tichu/page.tsx` | Wrap in AuthGuard |
| Modify | `packages/client/src/app/spectate/[gameId]/page.tsx` | Wrap in AuthGuard |

---

### Task 1: Create AuthGuard Component

**Files:**
- Create: `packages/client/src/components/AuthGuard.tsx`

- [ ] **Step 1: Create AuthGuard component**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, authReady, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (authReady && !user) {
      router.replace('/');
    }
  }, [authReady, user, router]);

  if (!authReady) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm --filter @tichu/client typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/AuthGuard.tsx
git commit -m "feat(auth): add AuthGuard component for route protection"
```

---

### Task 2: Replace Root Page with Login/Register Form

**Files:**
- Rewrite: `packages/client/src/app/page.tsx`
- Delete: `packages/client/src/app/login/page.tsx`

- [ ] **Step 1: Rewrite the root page**

Replace the entire content of `packages/client/src/app/page.tsx` with the login/register form. This is the content from `login/page.tsx` with these changes:
- Add auto-redirect to `/lobby` if already logged in (using `loadFromStorage` + `authReady` + `user`)
- Remove the guest button JSX (keep a comment noting it's hidden)
- Show a loading state while `authReady` is false

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'login' | 'register';

export default function Home() {
  const router = useRouter();
  const { user, authReady, login, register, loading, error, loadFromStorage } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  // Auto-redirect to lobby if already logged in
  useEffect(() => {
    if (authReady && user) {
      router.replace('/lobby');
    }
  }, [authReady, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(identifier, password);
    } else {
      const userId = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await register({ userId, username, email, password });
    }
    const currentError = useAuthStore.getState().error;
    if (!currentError) {
      router.push('/lobby');
    }
  };

  // Show loading while checking auth
  if (!authReady) {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--color-felt-green-dark)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </main>
    );
  }

  // If logged in, show nothing while redirect happens
  if (user) {
    return null;
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6" style={{ background: 'var(--color-felt-green-dark)' }}>
      <div className="w-full max-w-md p-6 rounded-xl" style={{ background: 'var(--color-bg-panel)' }}>
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: 'var(--color-gold-accent)' }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h1>

        {error && (
          <div className="mb-4 text-center py-2 px-4 rounded-lg"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }}
            role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' ? (
            <>
              <label className="block">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={30}
                  className="mt-1 w-full px-4 py-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                  aria-label="Username"
                />
              </label>

              <label className="block">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full px-4 py-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                  aria-label="Email"
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Username or Email</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="mt-1 w-full px-4 py-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="Username or email"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full px-4 py-2 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              aria-label="Password"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--color-gold-accent)', color: 'var(--color-felt-green-dark)' }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); useAuthStore.setState({ error: null }); }}
            className="text-sm underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign In'}
          </button>
        </div>

        {/* Guest access hidden — code preserved in authStore.initGuest() for future use */}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the /login route**

```bash
rm packages/client/src/app/login/page.tsx
rmdir packages/client/src/app/login
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm --filter @tichu/client typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/app/page.tsx
git rm packages/client/src/app/login/page.tsx
git commit -m "feat(auth): make root page the login form, delete /login route"
```

---

### Task 3: Protect Lobby Route and Update References

**Files:**
- Modify: `packages/client/src/app/lobby/page.tsx`

- [ ] **Step 1: Add AuthGuard import and wrap page content**

At the top of `lobby/page.tsx`, add the import:
```tsx
import { AuthGuard } from '@/components/AuthGuard';
```

Wrap the return value of `LobbyPage` in `<AuthGuard>`:
```tsx
return (
  <AuthGuard>
    <main className="p-6" ...>
      {/* existing content */}
    </main>
    {/* existing popups and overlays */}
  </AuthGuard>
);
```

- [ ] **Step 2: Update logout redirect from `/login` to `/`**

In the `handleLogout` function (around line 160), change:
```tsx
router.push('/login');
```
to:
```tsx
router.push('/');
```

- [ ] **Step 3: Update Sign In link from `/login` to `/`**

In the header area (around line 210), change:
```tsx
href="/login"
```
to:
```tsx
href="/"
```

- [ ] **Step 4: Remove guest-only UI elements**

The guest name input (`!isLoggedIn` block around line 256) and the Sign In link for guests become dead code since AuthGuard ensures only logged-in users reach the lobby. However, per the spec, we leave guest code intact but the AuthGuard already prevents guests from reaching this page. The guest name input and Sign In link won't render for logged-in users anyway (they're behind `!isLoggedIn` checks), so they're effectively hidden. No changes needed here.

- [ ] **Step 5: Verify the file compiles**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm --filter @tichu/client typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/app/lobby/page.tsx
git commit -m "feat(auth): protect lobby route, update /login refs to /"
```

---

### Task 4: Protect Game Route

**Files:**
- Modify: `packages/client/src/app/game/[gameId]/page.tsx`

- [ ] **Step 1: Add AuthGuard import**

Add at top of file:
```tsx
import { AuthGuard } from '@/components/AuthGuard';
```

- [ ] **Step 2: Wrap the component's rendered output**

The game page has multiple early returns and a final return. The simplest approach: wrap the entire `GamePage` export in an `AuthGuard` by creating a wrapper.

Replace the export:
```tsx
export default function GamePage(props: { params: Promise<{ gameId: string }> }) {
```

with a wrapper pattern — add a new default export that wraps the existing component:

At the very end of the file, after the existing `GamePage` function (rename it to `GamePageInner`), add:
```tsx
export default function GamePage(props: { params: Promise<{ gameId: string }> }) {
  return (
    <AuthGuard>
      <GamePageInner {...props} />
    </AuthGuard>
  );
}
```

And rename the original:
```tsx
function GamePageInner(props: { params: Promise<{ gameId: string }> }) {
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm --filter @tichu/client typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/app/game/[gameId]/page.tsx
git commit -m "feat(auth): protect game route with AuthGuard"
```

---

### Task 5: Protect Remaining Routes

**Files:**
- Modify: `packages/client/src/app/leaderboard/page.tsx`
- Modify: `packages/client/src/app/profile/page.tsx`
- Modify: `packages/client/src/app/spectate/[gameId]/page.tsx`
- Modify: `packages/client/src/app/stats/page.tsx`
- Modify: `packages/client/src/app/stats/cards/page.tsx`
- Modify: `packages/client/src/app/stats/history/page.tsx`
- Modify: `packages/client/src/app/stats/players/page.tsx`
- Modify: `packages/client/src/app/stats/tichu/page.tsx`

- [ ] **Step 1: Protect leaderboard page**

Add import and wrap the `LeaderboardPage` return in `<AuthGuard>`:
```tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function LeaderboardPage() {
  // ... existing state/effects ...
  return (
    <AuthGuard>
      <main className="min-h-dvh p-6" ...>
        {/* existing content */}
      </main>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Protect profile page and update `/login` reference**

Add import. The profile page uses `<Suspense>` wrapping `<ProfileContent>`. Wrap the `<Suspense>` in `<AuthGuard>`:
```tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <Suspense fallback={...}>
        <ProfileContent />
      </Suspense>
    </AuthGuard>
  );
}
```

In `ProfileContent`, change `router.push('/login')` (line 68) to `router.push('/')`.

- [ ] **Step 3: Protect spectate page**

The spectate page just redirects. Wrap it:
```tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function SpectatePage(props: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(props.params);
  return (
    <AuthGuard>
      <RedirectToGame gameId={gameId} />
    </AuthGuard>
  );
}

function RedirectToGame({ gameId }: { gameId: string }) {
  redirect(`/game/${gameId}`);
}
```

Note: Since `redirect()` is a server-side function from `next/navigation`, and we need client-side AuthGuard, use `useRouter` + `useEffect` instead:
```tsx
'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';

export default function SpectatePage(props: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(props.params);
  return (
    <AuthGuard>
      <RedirectToGame gameId={gameId} />
    </AuthGuard>
  );
}

function RedirectToGame({ gameId }: { gameId: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/game/${gameId}`); }, [router, gameId]);
  return null;
}
```

- [ ] **Step 4: Protect all stats pages**

For each stats page (`stats/page.tsx`, `stats/cards/page.tsx`, `stats/history/page.tsx`, `stats/players/page.tsx`, `stats/tichu/page.tsx`):

Add import:
```tsx
import { AuthGuard } from '@/components/AuthGuard';
```

Wrap the default export's return value in `<AuthGuard>`. Each stats page has a similar structure. For example, `stats/page.tsx`:

```tsx
export default function StatsOverviewPage() {
  // ... existing state/effects ...
  return (
    <AuthGuard>
      {/* existing JSX */}
    </AuthGuard>
  );
}
```

Repeat for all four sub-pages.

- [ ] **Step 5: Verify all files compile**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm --filter @tichu/client typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/app/leaderboard/page.tsx \
      packages/client/src/app/profile/page.tsx \
      packages/client/src/app/spectate/[gameId]/page.tsx \
      packages/client/src/app/stats/page.tsx \
      packages/client/src/app/stats/cards/page.tsx \
      packages/client/src/app/stats/history/page.tsx \
      packages/client/src/app/stats/players/page.tsx \
      packages/client/src/app/stats/tichu/page.tsx
git commit -m "feat(auth): protect leaderboard, profile, spectate, and stats routes"
```

---

### Task 6: Verify and Test

- [ ] **Step 1: Run type check across all packages**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Run linter**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm lint`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run tests**

Run: `cd /c/MATLAB/Claude/Tichu/code && pnpm test`
Expected: PASS

- [ ] **Step 4: Grep for any remaining `/login` references in client source**

Run: `grep -r "/login" packages/client/src/ --include="*.tsx" --include="*.ts"`
Expected: No results (the `authStore.ts` reference to `/api/auth/login` is a different path — API endpoint, not a route)

- [ ] **Step 5: Verify no orphaned login directory**

Run: `ls packages/client/src/app/login/ 2>/dev/null && echo "STILL EXISTS" || echo "DELETED"`
Expected: "DELETED"

- [ ] **Step 6: Start dev server and manually verify**

Run: `cd /c/MATLAB/Claude/Tichu/code && bash scripts/dev-start.sh`

Manual checks:
1. Visit `http://localhost:3000/` — should see login/register form
2. Visit `http://localhost:3000/lobby` — should redirect to `/`
3. Visit `http://localhost:3000/leaderboard` — should redirect to `/`
4. Register a new account — should redirect to `/lobby`
5. Visit `http://localhost:3000/` while logged in — should auto-redirect to `/lobby`
6. Click logout in lobby — should redirect to `/`
7. No "Skip — play as guest" button visible on the login form

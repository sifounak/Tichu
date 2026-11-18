# Authentication/navigation milestone

39 tests exercise authentication storage/requests, real guard composition, active-room refresh/rejoin and navigation lifecycle. A failing regression demonstrated that a late login restored a logged-out account. Request-version guards now invalidate stale guest/register/login/verification responses; logout settles loading and clears all identity storage.

Coverage: authStore 100% statements/87.32% branches; AuthGuard and ActiveGameBanner 100% statements/branches; navigation hook 97.40% statements/96.66% branches. Critical thresholds met. Client typecheck and lint pass; remaining lint warnings predate these covered modules.

Assistant: "The authentication tests found a race: a login response arriving after logout signs the user back in. I’ll guard against stale responses across the authentication operations so logout and newer requests take precedence."

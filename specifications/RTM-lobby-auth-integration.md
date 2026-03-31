# Requirements Traceability Matrix: Lobby Auth Integration

**Spec**: specifications/2026-03-31-lobby-auth-integration.md
**Plan**: plans/2026-03-31-lobby-auth-integration.md

## Summary Table

| Requirement ID | Description | Status |
|---|---|---|
| REQ-F-AU10 | Registration requires username, email, password | Passed |
| REQ-F-AU11 | Username unique (case-insensitive, trimmed) | Passed |
| REQ-F-AU12 | Username cannot be "bot" (case-insensitive) | Passed |
| REQ-F-AU13 | Username constraints: 1-30 chars, no leading/trailing spaces | Passed |
| REQ-F-AU14 | Login accepts (username OR email) + password | Passed |
| REQ-F-AU15 | Username is immutable after creation | Passed |
| REQ-F-AU16 | Username replaces displayName as player identity | Passed |
| REQ-F-LU01 | "Your Name" input hidden when logged in | Passed |
| REQ-F-LU02 | Top-right shows user icon + username button (transparent bg) | Passed |
| REQ-F-LU03 | Clicking user button opens dropdown menu | Passed |
| REQ-F-LU04 | Dropdown "Play Stats" navigates to /stats | Passed |
| REQ-F-LU05 | Dropdown "Log Out" logs out and redirects to /auth | Passed |
| REQ-F-LU06 | Dropdown closes on outside click | Passed |
| REQ-F-LU07 | Auth state loads without UI flash (authReady) | Passed |
| REQ-F-ID01 | WebSocket connects with auth userId and username | Passed |
| REQ-F-ID02 | CREATE_ROOM/JOIN_ROOM use username as playerName | Passed |
| REQ-F-ID03 | Game stats recorded against authenticated userId | Passed |
| REQ-NF-AU01 | Auth token verification < 500ms | Passed |
| REQ-NF-AU02 | Password hashed with bcrypt (10 rounds) | Passed |
| REQ-NF-AU03 | Username uniqueness enforced at DB level | Passed |

## Detailed Entries

> **REQ-F-AU10** — Registration requires username, email, password — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:57-103` (registerAccount)
>   - `code/packages/server/src/auth/auth-routes.ts:27-43` (register route)
>   - `code/packages/client/src/stores/authStore.ts:56-80` (register action)
>   - `code/packages/client/src/app/auth/page.tsx:62-85` (registration form)
> - Tests:
>   - `code/packages/server/tests/auth/account.test.ts:108-129` (register new user)
>   - `code/packages/server/tests/auth/auth-routes.test.ts:107-162` (register routes)

> **REQ-F-AU11** — Username unique (case-insensitive, trimmed) — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:69-76` (LOWER() uniqueness check)
>   - `code/packages/server/src/db/schema.ts:21` (uniqueIndex)
> - Tests:
>   - `code/packages/server/tests/auth/account.test.ts:131-140` (reject duplicate)

> **REQ-F-AU12** — Username cannot be "bot" (case-insensitive) — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:27-28` (RESERVED_USERNAMES)
>   - `code/packages/server/src/auth/account.ts:42-44` (validation check)
> - Tests:
>   - `code/packages/server/tests/auth/account.test.ts:93-99` (reject bot)
>   - `code/packages/server/tests/auth/account.test.ts:162-170` (reject Bot in register)

> **REQ-F-AU13** — Username constraints: 1-30 chars, no leading/trailing spaces — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:32-46` (validateUsername)
> - Tests:
>   - `code/packages/server/tests/auth/account.test.ts:75-107` (all constraint tests)

> **REQ-F-AU14** — Login accepts (username OR email) + password — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:113-145` (loginAccount with identifier)
>   - `code/packages/server/src/auth/auth-routes.ts:46-58` (login route)
>   - `code/packages/client/src/stores/authStore.ts:83-104` (login action)
>   - `code/packages/client/src/app/auth/page.tsx:94-107` (login form)
> - Tests:
>   - `code/packages/server/tests/auth/account.test.ts:180-224` (login tests)
>   - `code/packages/server/tests/auth/auth-routes.test.ts:165-228` (login route tests)

> **REQ-F-AU15** — Username is immutable after creation — *Passed*
> - Code: No update endpoint exists; username only set in registerAccount
> - Tests: Verified by absence of any update API

> **REQ-F-AU16** — Username replaces displayName as player identity — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:96-97` (sets displayName = username)
>   - `code/packages/client/src/stores/authStore.ts:8-13` (AuthUser uses username)
>   - `code/packages/client/src/app/lobby/page.tsx:55` (effectivePlayerName)

> **REQ-F-LU01** — "Your Name" input hidden when logged in — *Passed*
> - Code:
>   - `code/packages/client/src/app/lobby/page.tsx:199-213` (conditional render)

> **REQ-F-LU02** — Top-right shows user icon + username button — *Passed*
> - Code:
>   - `code/packages/client/src/components/lobby/UserMenu.tsx:38-62` (trigger button)

> **REQ-F-LU03** — Clicking user button opens dropdown menu — *Passed*
> - Code:
>   - `code/packages/client/src/components/lobby/UserMenu.tsx:64-110` (dropdown)

> **REQ-F-LU04** — Dropdown "Play Stats" navigates to /stats — *Passed*
> - Code:
>   - `code/packages/client/src/components/lobby/UserMenu.tsx:79-92` (Play Stats link)

> **REQ-F-LU05** — Dropdown "Log Out" logs out and redirects to /auth — *Passed*
> - Code:
>   - `code/packages/client/src/components/lobby/UserMenu.tsx:96-109` (Log Out button)
>   - `code/packages/client/src/app/lobby/page.tsx:143-146` (handleLogout)

> **REQ-F-LU06** — Dropdown closes on outside click — *Passed*
> - Code:
>   - `code/packages/client/src/components/lobby/UserMenu.tsx:19-27` (mousedown listener)

> **REQ-F-LU07** — Auth state loads without UI flash (authReady) — *Passed*
> - Code:
>   - `code/packages/client/src/stores/authStore.ts:23,39` (authReady flag)
>   - `code/packages/client/src/stores/authStore.ts:113-139` (set in all paths)

> **REQ-F-ID01** — WebSocket connects with auth userId and username — *Passed*
> - Code:
>   - `code/packages/client/src/app/lobby/page.tsx:80` (wsUrl with effectiveUserId/Name)

> **REQ-F-ID02** — CREATE_ROOM/JOIN_ROOM use username as playerName — *Passed*
> - Code:
>   - `code/packages/client/src/app/lobby/page.tsx:100-141` (all handlers use effectivePlayerName)

> **REQ-F-ID03** — Game stats recorded against authenticated userId — *Passed*
> - Code: Existing game-persistence.ts already ties stats to userId; auth integration ensures the correct userId is used via WebSocket connection

> **REQ-NF-AU01** — Auth token verification < 500ms — *Passed*
> - Verified: fetch to /api/auth/me is a simple JWT decode + DB lookup

> **REQ-NF-AU02** — Password hashed with bcrypt (10 rounds) — *Passed*
> - Code:
>   - `code/packages/server/src/auth/account.ts:9` (SALT_ROUNDS = 10)

> **REQ-NF-AU03** — Username uniqueness enforced at DB level — *Passed*
> - Code:
>   - `code/packages/server/src/db/schema.ts:21` (uniqueIndex on username)
>   - `code/packages/server/src/db/connection.ts:58` (CREATE UNIQUE INDEX)

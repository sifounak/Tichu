# Account preferences traceability

| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| UP01 | shared/src/types/preferences.ts:4; server/src/auth/preferences-routes.ts:10; server/src/db/schema.ts and connection.ts | server/tests/auth/preferences-routes.test.ts: 12 passed, routes 100% coverage; disk reopen and CORS checked | Passed |
| UP02 | client/src/components/lobby/UserMenu.tsx; GameActionsMenu, GameActionsDrawer, PreRoomView; game page | PreferencesMenus.test.tsx: 5 passed; production browser pre-game access | Passed |
| UP03 | client/src/components/preferences/PreferencesDialog.tsx; stores/preferencesStore.ts | PreferencesDialog.test.tsx and preferencesStore.test.ts: 17 passed | Passed |
| UP04–UP06 | client/src/components/cards/card-utils.ts:85; CardHand.tsx:30; CardRow.tsx; Card.module.css; game/TrickDisplay.tsx; game page bomb previews | card-preferences.test.tsx: 13 passed; production browser checks all modes, exposed labels, and 14-card hands | Passed |
| UP07 | client/src/hooks/useSoundEffects.ts | useSoundEffects.test.ts: 7 passed, 100% statement coverage | Passed |
| NF-UP01 | Preferences store/controller/dialog | PreferencesController.test.tsx: 2 passed; store and dialog regression tests | Passed |

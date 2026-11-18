# Preferences editing milestone

Implemented saved account preferences store, immediate identity reset and stale request guards, controller, focus refresh, draft-only editing dialog with live hand/full-house previews, lobby/desktop/mobile menu access, and shared audio category gating.

29 feature tests pass; client typecheck passes. Targeted store/dialog/preview/audio coverage is 99.69% statements. Focus-trap tests exposed a selector inconsistency in jsdom; filtering controls by disabled properties now verifies real keyboard navigation and focus restoration. Sorting/stacking helpers and card identifiers were introduced here so previews use production rendering; gameplay consumers will be connected in milestone 3.

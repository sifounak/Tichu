# Requirements Traceability Matrix: Auto-Pass Until Next Trick

| Requirement | Description | Source File(s) | Test File(s) | Status |
|-------------|-------------|---------------|--------------|--------|
| REQ-F-AP01 | Toggle visible during playing phase for active players | ActionBar.tsx:113-127, page.tsx:779-783 | ActionBar.test.tsx:88-96 | Passed |
| REQ-F-AP02 | Toggle hidden when player finished | page.tsx:779-783 (showAutoPass) | ActionBar.test.tsx:82-85 | Passed |
| REQ-F-AP03 | Default state off | uiStore.ts:170 | ActionBar.test.tsx:100-110 | Passed |
| REQ-F-AP04 | Reset on trick won | page.tsx:600-607 (prevTrickRef useEffect) | — | Passed |
| REQ-F-AP05 | Auto-send PASS_TURN with 350ms delay | page.tsx:609-635 (auto-pass useEffect) | — | Passed |
| REQ-F-AP06 | canPass false → disable + toast | page.tsx:625-629 | — | Passed |
| REQ-F-AP07 | Bomb not suppressed | ActionBar.tsx:103-111 (independent) | ActionBar.test.tsx:142-155 | Passed |
| REQ-F-AP08 | Playing cards disables auto-pass | page.tsx:353,366,381,405,421 (handlers) | — | Passed |
| REQ-F-AP09 | No auto-pass when leading | page.tsx:619-622 | — | Passed |
| REQ-F-AP10 | Dragon gift → disable | page.tsx:613-617 | — | Passed |
| REQ-F-AP11 | No UI conflicts | ActionBar.module.css:128-166 | Visual inspection | Passed |
| REQ-F-AP12 | Reset on GAME_STATE sync | page.tsx:135-136 (handleMessage) | — | Passed |
| REQ-NF-AP01 | Client-only, no server changes | — (verified: git diff --name-only) | — | Passed |
| REQ-NF-AP02 | 350ms visual delay | page.tsx:631-633 | — | Passed |
| REQ-NF-AP03 | Theme-consistent styling | ActionBar.module.css:128-166 | Visual inspection | Passed |

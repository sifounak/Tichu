# Requirements Traceability Matrix — Two-Tier Layout

| Req ID | Description | Source File(s) | Status |
|--------|------------|---------------|--------|
| REQ-F-L01 | LayoutTier type: full \| mobile | useLayoutTier.ts:5 | Passed |
| REQ-F-L02 | Breakpoint at 900px | useLayoutTier.ts:8 | Passed |
| REQ-F-L03 | Full layout uses CSS grid | GameTable.module.css:5-18 | Passed |
| REQ-F-L04 | Mobile layout uses flexbox column | GameTable.module.css:119-163 | Passed |
| REQ-F-L05 | Full layout uses large card sizes | page.tsx:1728 | Passed |
| REQ-F-L06 | Mobile layout uses mobile card sizes | page.tsx:1728 | Passed |
| REQ-F-L07 | Chat auto-collapse on full→mobile | page.tsx:79 | Passed |
| REQ-F-L08 | Remove all data-layout="compact" CSS | All 8 CSS files | Passed |
| REQ-F-L09 | Remove compact from useScaleFactor | useScaleFactor.ts:13-15 | Passed |
| REQ-F-L10 | Update mobile scale config | useScaleFactor.ts:14 | Passed |
| REQ-F-L11 | Rename isCompact→isMobile vars | page.tsx, GameTable.tsx, ActionBar.tsx, PreRoomView.tsx, ChatPanel.tsx | Passed |
| REQ-NF-L01 | No visual regression at ≥1100px | Visual test needed | Pending |
| REQ-NF-L02 | No visual regression at <700px | Visual test needed | Pending |
| REQ-NF-L03 | Full layout usable at 900–1100px | Visual test needed | Pending |
| REQ-NF-L04 | Type-check passes | pnpm typecheck | Passed |
| REQ-NF-L05 | All tests pass | pnpm test | Passed |

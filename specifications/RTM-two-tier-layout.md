# Requirements Traceability Matrix — Two-Tier Layout

| Req ID | Description | Source File(s) | Status |
|--------|------------|---------------|--------|
| REQ-F-L01 | LayoutTier type: full \| mobile | useLayoutTier.ts | Not Started |
| REQ-F-L02 | Breakpoint at 900px | useLayoutTier.ts | Not Started |
| REQ-F-L03 | Full layout uses CSS grid | GameTable.module.css | Not Started |
| REQ-F-L04 | Mobile layout uses flexbox column | GameTable.module.css | Not Started |
| REQ-F-L05 | Full layout uses large card sizes | page.tsx | Not Started |
| REQ-F-L06 | Mobile layout uses mobile card sizes | page.tsx | Not Started |
| REQ-F-L07 | Chat auto-collapse on full→mobile | page.tsx | Not Started |
| REQ-F-L08 | Remove all data-layout="compact" CSS | 8 CSS files | Not Started |
| REQ-F-L09 | Remove compact from useScaleFactor | useScaleFactor.ts | Not Started |
| REQ-F-L10 | Update mobile scale config | useScaleFactor.ts | Not Started |
| REQ-F-L11 | Rename isCompact→isMobile vars | 5 component files | Not Started |
| REQ-NF-L01 | No visual regression at ≥1100px | Visual test | Not Started |
| REQ-NF-L02 | No visual regression at <700px | Visual test | Not Started |
| REQ-NF-L03 | Full layout usable at 900–1100px | Visual test | Not Started |
| REQ-NF-L04 | Type-check passes | pnpm typecheck | Not Started |
| REQ-NF-L05 | All tests pass | pnpm test | Not Started |

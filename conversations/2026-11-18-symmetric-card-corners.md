# Symmetric card corners and simpler preferences

The user noticed right-side identifiers felt closer to the edge. Inspection confirmed equal CSS insets but unequal glyph padding and independent rank/suit alignment. Approved a shared, horizontally centered corner block, width 1.5 times rank font size, retaining equal 4.5% edge insets and existing vertical spacing. The user also requested removal of the full-house preview and caption from Preferences, leaving one live example hand. Gameplay full-house stacking remains unchanged.

Latest instruction: Implement the approved plan.

Implemented shared centered corner blocks for standard ranks/suits and special-card abbreviations. Removed only the Preferences full-house sample/caption; game full-house stacking and preferences persistence are unchanged. Updated browser checks to measure rank and suit explicitly and verify five card sizes. 72 card/preferences tests pass, targeted statement coverage 99.5%, workspace type checking passes, and desktop/mobile Chromium checks pass including a real 14-card hand. Validation and screenshots archived under results/Milestone1/symmetric-card-corners/.

Production client build passed using the same external Windows junction compatibility preload as the original feature. No build configuration/dependency changes; ESLint remains unavailable. Changes committed locally on bugfix/symmetric-card-corners.

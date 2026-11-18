# Account preferences

Approved design: account preferences with Save/Cancel and live, non-interactive hand and full-house previews. No guest, volume, or animation preferences.

| Requirement | Behavior |
|---|---|
| REQ-F-UP01 | Account-only GET/PUT preferences; persistent SQLite storage; descending/right-on-top/all sounds on defaults. |
| REQ-F-UP02 | Preferences accessible from lobby account menu and desktop/mobile game menus, including spectators. |
| REQ-F-UP03 | Dialog drafts update previews only; Save persists and applies; Cancel/X/Escape/backdrop discard. Failed saves retain drafts; loading prevents editing. |
| REQ-F-UP04 | Independent Low to high/High to low order and Left cards on top/Right cards on top overlap throughout card displays. |
| REQ-F-UP05 | Full-house triple always at the top end of the chosen stack, including substituted Phoenix. |
| REQ-F-UP06 | Exposed-edge identifiers remain readable; preserve selection, identity, keyboard focus, and semantic seat slots. |
| REQ-F-UP07 | Sound enabled plus Cards and wagers/Your turn/Timer warning/Chat switches; default 70% playback; legacy browser controls retired. |
| REQ-NF-UP01 | Accessible responsive dialog; isolated account state and stale request protection; refresh on focus when closed. |

Guest removal, volume, animation, card size, and default chat visibility remain separate work.

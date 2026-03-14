---
name: project_state
description: Major features implemented and key architectural decisions for the fantasy dashboard
type: project
---

RBI is now a 10th scoring category alongside HR, R, SB, OBP, ERA, WHIP, K, SV, W.

**Why:** User requested it as a core scoring category across all pages.
**How to apply:** Always treat RBI as a scoring category like the others; it appears in BASEBALL_CATEGORIES and has category weights.

BB (walks) is now tracked as a supplementary stat column (not a scoring category).

SO9/K9 aliases removed from K mapping — only raw SO/K counts map to the K category.

Batter/pitcher stat cross-filtering: batters get ERA/WHIP/SV/W/IP/GS/K removed; pitchers get AB removed. Exception: Shohei Ohtani gets all stats.

Position inference: if a baseball player has no position column but has ERA/WHIP data, they're inferred as 'P' (pitcher).

Two-bucket upload: upload page has separate "Past Stats" and "Future Projections" zones. Store has `pastPlayers`, `projectionPlayers`, `dataMode` ('past'|'projections'|'both', default 'both'). When both have data, stats are equally averaged per player; projections take precedence for team/position.

Data mode toggle: present on Analysis, Auction, and Draft pages. Uses `DataModeToggle` component at `components/shared/DataModeToggle.tsx`.

Store version bumped: `baseball-store-v2`, `basketball-store-v2` (clears old localStorage).

TrackDraft redesigned: now has a setup phase (team count → team names) before showing the draft board. Draft board has available players with inline "Draft" assignment (team dropdown + price), editable suggested values per player, per-team budget tracking with adjustable totals.

MyDraft: each player row has an inline price input (pre-filled with suggested auction value); Draft button is in the action column.

# Fantasy Dashboard — CLAUDE.md

## Project Overview
Fantasy sports analytics web app for categories-based head-to-head leagues (MLB + NBA).
Win a week by winning a majority of stat categories. The app ingests uploaded player data, ranks players via z-scores, and provides draft tools (auction for baseball, snake for basketball).

**Location:** `~/Documents/fantasy-dashboard`
**Dev server:** `npm run dev` → http://localhost:3000

---

## Tech Stack
- **Next.js** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — CSS-based config via `@theme inline` in `app/globals.css` (NO `tailwind.config.ts`)
- **Zustand** with `persist` middleware (localStorage) — all state lives in browser
- **SheetJS (`xlsx`)** for Excel, **PapaParse** for CSV
- No database, no backend API calls

---

## File Structure

```
app/
  layout.tsx           # Root layout (dark bg, ClientLayout wrapper)
  ClientLayout.tsx     # 'use client' layout — Header + data-sport attr
  globals.css          # Tailwind v4 @theme, color tokens, animations
  page.tsx             # Redirects to /{activeSport}/analysis
  upload/page.tsx
  baseball/
    setup/page.tsx
    analysis/page.tsx
    auction/page.tsx
    draft/page.tsx
  basketball/
    setup/page.tsx
    analysis/page.tsx
    draft/page.tsx

components/
  layout/Header.tsx    # App title, SportToggle, nav links
  upload/
    FileUploadZone.tsx # react-dropzone, multi-file, merges sources
    ColumnMapper.tsx   # Override auto-detected column mappings
  baseball/
    LeagueSetup.tsx
    PlayerAnalysis.tsx
    AuctionCalculator.tsx
    DraftMode.tsx / MyDraft.tsx / TrackDraft.tsx
  basketball/
    LeagueSetup.tsx
    PlayerAnalysis.tsx
    DraftMode.tsx / NextBestAvailable.tsx
  shared/
    StatTable.tsx      # Sortable table — renders ReactNode directly (no String() cast)
    RankBadge.tsx      # Animated rank badge
    CategorySlider.tsx
    CategoryRadar.tsx  # Recharts RadarChart

store/
  useSportStore.ts     # activeSport: 'baseball' | 'basketball'
  useBaseballStore.ts  # players, settings, draft state
  useBasketballStore.ts

utils/
  constants.ts         # Categories, positions, allowed columns, stat aliases
  fileParser.ts        # Parse CSV/Excel, normalize rows, merge sources
  rankings.ts          # Z-score ranking, volume adjustment
  auctionCalc.ts       # Replacement-level dollar values
  draftEngine.ts       # Draft mutations, NBA next-best-available
```

---

## Visual Design
- **Background:** `#0A0E1A` (dark navy) — `var(--navy)`
- **Cards:** `#111827` — `var(--card)`
- **Baseball accent:** `#00FF88` (neon green) — `var(--neon)`
- **Basketball accent:** `#00BFFF` (electric blue) — `var(--electric)`
- **Active accent:** `var(--accent)` — switches via `data-sport` attribute on root div
- **Display font:** Bebas Neue (Google Fonts) — `font-display` class
- **Body font:** DM Sans
- **Mono font:** JetBrains Mono

The `data-sport="baseball"` / `data-sport="basketball"` attribute on the root div in `ClientLayout.tsx` drives CSS variable overrides for the accent color scheme.

---

## Scoring Categories

**Baseball:** `HR, R, SB, OBP, ERA, WHIP, K, SV, W`
- Negative categories (lower is better): `ERA, WHIP`
- Volume stats (shrink low-volume toward league mean): `ERA` (IP), `WHIP` (IP), `OBP` (PA)

**Basketball:** `PTS, REB, AST, STL, BLK, 3PM, FG%, FT%, TOV`
- Negative: `TOV`
- Volume stats: `FG%` (FGA), `FT%` (FTA)

---

## Column Detection Logic (`utils/fileParser.ts`)

`STAT_COLUMN_ALIASES` in `utils/constants.ts` maps raw CSV/Excel header names → canonical keys.
- Sports Reference uses `SO` for strikeouts → maps to `K`
- Sports Reference uses `BA` for batting average → maps to `AVG`
- Sports Reference uses `Tm` for team → matched by `findTeamColumn`
- Position column: `Pos`, `Position`, `Pos.`, `Elig`, `Eligibility`

**Position code parsing** (`parsePositions` in fileParser.ts):
- Numeric codes: `1`=SP, `2`=C, `3`=1B, `4`=2B, `5`=3B, `6`=SS, `7/8/9`=OF
- Letter codes: `d`=DH, `p`/`sp`=SP, `rp`=RP
- Concatenated codes: `D3` = DH+1B, `5H` = 3B+DH (parsed char-by-char)
- Leading `*` and trailing `+` are stripped before parsing

**Allowed columns** (everything else is ignored):
- Baseball: `HR, R, RBI, SB, OBP, ERA, WHIP, K, SV, W, AVG, AB, PA, G, IP, GS, STATUS`
- Basketball: `PTS, REB, AST, STL, BLK, 3PM, FG%, FT%, TOV, FGA, FGM, FTA, FTM, MIN, GP, STATUS`

**Row filtering** (in `normalizeRows`):
- Skip blank name
- Skip rows where name = `"Rk"`, `"Player"`, or `"Name"` (Sports Reference repeated header rows)
- Skip rows where name matches `/^total/i`
- Skip rows where name is all digits

---

## Ranking Algorithm (`utils/rankings.ts`)

**Z-score normalization:**
```
z = (playerValue - μ) / σ
Negative categories: z = -z
Composite score = Σ(weight[cat] × z[cat]) / Σ(weight[cat])
```
- σ = 0 edge case: assign z = 0
- Missing stat: excluded from that category entirely

**Volume adjustment (shrinkage for rate stats):**
```
weight = min(player.volume, leagueMedianVolume) / leagueMedianVolume
adjustedStat = weight × player.stat + (1 - weight) × leagueMean
```

---

## Auction Value Calc (`utils/auctionCalc.ts`)

Replacement-level value-above-replacement (VAR):
```
replacementZ = compositeZ of (numTeams × totalRosterSlots)-th ranked player
VAR = max(0, compositeZ - replacementZ)
totalMoney = numTeams × budget - numTeams × totalRosterSlots × 1
playerValue = (VAR / Σ(all positive VAR)) × totalMoney
```

**Live punt adjustment:** After each pick, categories where myTeam z > +1.0 get 50% weight reduction; categories where z < −0.5 get 25% weight boost. Values recalculate after every pick.

---

## Draft Engine (`utils/draftEngine.ts`)

**Baseball:** Auction + punt-adjusted values. TrackDraft tracks all teams' picks + prices.

**Basketball (NBA Next Best Available):**
```
For each candidate P:
  hypotheticalTeam = myTeam + [P]
  projectedWins = count(categories where team z > league avg)
  score = projectedWins × 1000 + compositeVAR(P)
Top 5 by score; show category impact chips (↑ REB, ↓ FT%) + FG%/FT% delta
```
FG%/FT% dilution: `projectedTeamFGPct = Σ(FGM + candidate.FGM) / Σ(FGA + candidate.FGA)`

---

## Multi-File Merging (`utils/fileParser.ts → mergeProjectionSources`)

- Players matched across files by fuzzy name (Levenshtein distance ≤ 2 after normalization)
- Stats averaged per-column with per-stat source count tracking
- Positions merged (union)
- `sourcesIncluded` field shows how many files contributed to each player

---

## State Stores (`store/`)

All stores use Zustand `persist` (localStorage). Key actions:
- `setPlayers(players)` — replaces current player list
- `clearPlayers()` — wipes players (used by Clear Data button)
- `draftPlayer(player, price?)` — adds to myTeam
- `undoLastPick()` / `resetDraft()`
- `toggleCategory(cat)` — add/remove from selectedCategories
- `setCategoryWeight(cat, weight)`

---

## Known Pitfalls / Gotchas

1. **StatTable renders `ReactNode` directly** — never wrap `col.format()` output in `String()`. The format function returns `React.ReactNode`, not a string.

2. **Two-way players (e.g. Ohtani)** — Sports Reference exports them as two separate rows (`(Batting)` / `(Pitching)` suffix). They will NOT fuzzy-match each other because of the suffix difference; they appear as two distinct players.

3. **Tailwind CSS v4** — config is in `app/globals.css` with `@theme inline { ... }`, not `tailwind.config.ts`. Adding new design tokens must go in globals.css.

4. **`data-sport` attribute** — set on the root `<div>` in `ClientLayout.tsx`. CSS accent color switching works via `[data-sport="baseball"]` and `[data-sport="basketball"]` selectors in globals.css.

5. **Sports Reference pitching "R" column** — Maps to our `R` (Runs Scored) category via alias. This is incorrect semantically (pitching R = Runs Allowed) but currently accepted since it's filtered out for non-pitching players anyway.

6. **Budget/Teams editing on Auction page** — inline click-to-edit fields; save on blur or Enter, cancel on Escape.

7. **RBI** — stored as `stats.RBI`, shown as an informational column in Analysis but NOT a ranking category (not in `BASEBALL_CATEGORIES`).

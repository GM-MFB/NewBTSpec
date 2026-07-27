# Screener — Expanded Filters & Grouped Layout — Design

## Context

The Screener tab currently has 19 filter categories in one flat dropdown
grid. This adds ~21 more real Finviz filter categories (growth, margin,
ownership, and technical indicators) and reorganizes the ~40 resulting
dropdowns into three collapsible sections — **Descriptive / Fundamental /
Technical** — matching Finviz's own screener categorization, so the page
stays scannable as the filter count grows.

## Filter data — `src/lib/finvizFilters.js`

Each `FILTER_GROUPS` entry gains a `category: 'descriptive' | 'fundamental'
| 'technical'` field. Existing 19 groups are assigned:

- **Descriptive**: `price`, `marketCap`, `avgVolume`, `shortInterest`,
  `analystRecom`, `optionable`, `shortable`, `sector`, `country`,
  `exchange`, `index` (11)
- **Fundamental**: `pe`, `forwardPE`, `peg`, `dividendYield`,
  `payoutRatio` (5)
- **Technical**: `beta`, `perf52w`, `perfYtd` (3)

New groups, using Finviz's real documented filter codes:

**Fundamental (14 new):**
- `epsGrowthThisYear` (`fa_epsyoy_...`), `epsGrowthNextYear` (`fa_epsyoy1_...`)
- `salesGrowth5y` (`fa_sales5years_...`)
- `roe` (`fa_roe_...`), `roa` (`fa_roa_...`)
- `debtEquity` (`fa_debteq_...`)
- `grossMargin` (`fa_grossmargin_...`), `operatingMargin` (`fa_opermargin_...`), `netMargin` (`fa_netmargin_...`)
- `priceBook` (`fa_pb_...`), `priceSales` (`fa_ps_...`), `priceCashFlow` (`fa_pc_...`)
- `insiderOwn` (`sh_insiderown_...`), `instOwn` (`sh_instown_...`)

**Technical (7 new):**
- `rsi` (`ta_rsi_...`)
- `sma20` / `sma50` / `sma200` (`ta_sma20_...` etc. — price vs. moving average)
- `highLow50d` (`ta_highlow50d_...`)
- `changeToday` (`ta_change_...`)
- `relVolume` (`ta_relvol_...`)

Each new group follows the exact same shape as existing ones (`{ key,
label, category, options: [{ value: '', label: 'Any' }, ...] }`), with 3-6
sensible bucketed options per group (e.g. ROE: Positive / Over 10% / Over
20% / Over 30%; RSI: Oversold (<30) / Overbought (>70) / Not Overbought
(<60) / Not Oversold (>40)).

## Component — `src/components/analysis/ScreenerTab.jsx`

Replace the single flat `.screener-filter-grid` with three `<details
open>` sections (same collapsible pattern already used by
`SectorBrowser.jsx`), one per category, each containing that category's
filter grid:

```jsx
const CATEGORY_LABELS = { descriptive: 'Descriptive', fundamental: 'Fundamental', technical: 'Technical' }

{['descriptive', 'fundamental', 'technical'].map((cat) => (
  <details key={cat} open className="screener-category">
    <summary>{CATEGORY_LABELS[cat]}</summary>
    <div className="screener-filter-grid">
      {FILTER_GROUPS.filter((g) => g.category === cat).map((group) => (
        /* existing per-group <label><select> markup, unchanged */
      ))}
    </div>
  </details>
))}
```

All three sections default **open** (not collapsed) — matches the
established preference from the Frontier assumptions-editor feedback
earlier ("it's not visible/expanded by default" was flagged as a problem
there; same reasoning applies here).

No changes to `buildFinvizUrl`, `useScreenerSaves`, the URL bar, or the
Saved Presets section — filter *values* still flow through the same flat
`filters` state object keyed by group `key`, regardless of which category
section a group's dropdown lives in.

## Out of scope

- Active-filter count badge or a "Clear All" button — not part of what was
  approved; can be a follow-up if wanted.
- Replicating Finviz's full ~50-filter catalog exactly — this adds a
  curated, high-value subset (21 new groups), not every filter Finviz has.

## Testing

- `finvizFilters.js`: extend the existing shape tests to also assert every
  group has a valid `category` (one of the three), and that the total
  group count grew as expected (`>= 38`).
- `ScreenerTab.jsx`: renders three category sections with the right
  headings; a filter group's `<select>` appears under its own category
  section (e.g. `rsi` under Technical, `roe` under Fundamental); selecting
  a newly-added filter updates the built URL exactly like an existing one
  (reuses the existing URL-update test pattern, just against a new key).

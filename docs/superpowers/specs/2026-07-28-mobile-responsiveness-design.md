# Mobile Responsiveness — Design

## Context

The app renders badly on phones. The cause is structural, not cosmetic: it was built desktop-first and only 4 of 26 CSS files contain any media query (`TradeRow.css`, `TradeCalendar.css`, `LoginPage.css`, `modal.css`). The `index.html` viewport meta tag is already correct, so the problem is entirely in the stylesheets.

Three concrete failures at a 375px viewport:

1. **Horizontal padding.** Eighteen page/section containers hardcode `padding: Npx 32px Mpx`. That's 64px of a 375px screen — 17% — spent on dead margin.
2. **Header.** `.app-nav` holds 6 `NavLink`s in a pill row inside a `flex-wrap: wrap` header that also carries the account switcher, refresh button, settings link, and Add Trade button. On a phone it collapses into a tall stack.
3. **Horizontal overflow.** Two chart grids use `grid-template-columns: repeat(auto-fit, minmax(420px, 1fr))` — a 420px floor is wider than the phone, so the entire page body scrolls sideways. Separately, five components render `<table>` elements with no `overflow-x` wrapper: `CorrelationHeatmap`, `FrontierPanel`, `RiskTab`, `SymbolPanels`, `StatsPage`.

**Scope decision (user-selected):** minimal pass — fix padding, overflow, and the header. No layout rethinking, no per-page mobile redesign, no card-ification of tables. Dense analysis views (Efficient Frontier, DCF, Financials statements, Correlation heatmap) remain desktop-oriented; they just need to scroll cleanly inside their own container instead of breaking the page.

## 1. Page padding via a single CSS variable

Add to `:root` in `src/index.css`:

```css
--page-pad-x: 32px;
```

and one media query:

```css
@media (max-width: 640px) {
  :root { --page-pad-x: 16px; }
}
```

Then replace the horizontal `32px` literal with `var(--page-pad-x)` in each of the following declarations. The vertical values are unchanged:

| File | Current |
|---|---|
| `src/components/Header.css:6` | `padding: 20px 32px` |
| `src/components/InvestmentRow.css:4` | `padding: 12px 32px 40px` |
| `src/components/StatsCharts.css:2` | `padding: 20px 32px 40px` |
| `src/components/TradeRow.css:4` | `padding: 12px 32px 40px` |
| `src/components/analysis/DCFTab.css:2` | `padding: 20px 32px 40px` |
| `src/components/analysis/FinancialsTab.css:2` | `padding: 20px 32px 40px` |
| `src/components/analysis/ResearchTab.css:2` | `padding: 20px 32px 40px` |
| `src/components/analysis/RiskTab.css:2` | `padding: 20px 32px 40px` |
| `src/components/analysis/ScreenerTab.css:2` | `padding: 20px 32px 40px` |
| `src/pages/AnalyzePage.css:5` | `padding: 16px 32px 0` |
| `src/pages/ChartsPage.css:4` | `padding: 20px 32px 40px` |
| `src/pages/InvestmentsPage.css:56` | `padding: 20px 32px 0` |
| `src/pages/InvestmentsPage.css:92` | `padding: 12px 32px 40px` |
| `src/pages/StatsPage.css:7` | `padding: 16px 32px 0` |
| `src/pages/StatsPage.css:105` | `padding: 20px 32px 40px` |
| `src/pages/TradesPage.css:40` | `padding: 16px 32px 0` |
| `src/pages/TradesPage.css:63` | `padding: 12px 32px 40px` |
| `src/pages/WatchlistPage.css:2` | `padding: 20px 32px 40px` |

This yields one media query instead of eighteen, and any page added later inherits the behavior by using the variable.

`TradeCalendar.css` is deliberately excluded — it already has its own `@media (max-width: 640px)` block setting `margin: 20px 16px`, and it uses `margin`, not `padding`. Leave it as-is.

## 2. Header nav as a horizontal scroll strip

Below `640px`, in `src/components/Header.css`:

- `.app-nav` gets `flex-wrap: nowrap` and `overflow-x: auto` so the 6 links stay on one swipeable row rather than stacking.
- Hide the scrollbar chrome (`scrollbar-width: none`, `&::-webkit-scrollbar { display: none }`) so it reads as a tab strip rather than a scrolling box.
- `.app-nav` takes `width: 100%` so it occupies its own row beneath the account switcher and actions, instead of competing with them for horizontal space.
- Add `-webkit-overflow-scrolling: touch` for iOS momentum scrolling.

No hamburger menu, no nav restructuring, no changes to `Header.jsx`. All 6 destinations remain reachable.

## 3. Eliminate horizontal overflow

**Chart grids.** In `src/components/StatsCharts.css:4` and `src/components/analysis/FinancialsCharts.css:3`, change:

```css
grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
```

to:

```css
grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
```

`min()` caps the track floor at the container width, so on a narrow screen the column collapses to 100% instead of forcing a 420px overflow. Desktop behavior is unchanged. The other `minmax()` grids in the codebase use floors of 200–260px, which already fit a 375px viewport; they are left alone.

**Tables.** Five components render a `<table>` with no scroll container. Each gets its table wrapped in a `div` with `overflow-x: auto`, following the existing `.fin-table-wrap` pattern in `FinancialsTab`:

| Component | Tables in file | New wrapper class |
|---|---|---|
| `src/components/analysis/CorrelationHeatmap.jsx` | 1 | `.corr-table-wrap` |
| `src/components/analysis/FrontierPanel.jsx` | 1 | `.frontier-table-wrap` |
| `src/components/analysis/RiskTab.jsx` | 3 | `.risk-table-wrap` |
| `src/components/analysis/SymbolPanels.jsx` | 1 | `.symbol-table-wrap` |
| `src/pages/StatsPage.jsx` | 2 | `.stats-table-wrap` |

Each wrapper class is defined in that component's own CSS file as `{ overflow-x: auto; }`. Where a file renders more than one `<table>` — `RiskTab` has 3 (Options Risk, the per-scenario stress table, and Risk Contribution) and `StatsPage` has 2 — **every** table gets its own wrapper, reusing the same class within that file. Total: 8 tables across 5 files.

The tables themselves are not restructured — no card layout, no column hiding, no responsive table transformation. They scroll horizontally within their own bounds, which is the intended "doesn't break" behavior for dense analysis data.

## Testing

jsdom does not compute layout or evaluate media queries, so the responsive behavior itself cannot be meaningfully unit-tested in Vitest. This is stated explicitly so no one later mistakes the test suite for proof of mobile correctness.

**What is tested:** the structural change in Section 3 — that each of the five components renders its table inside the new wrapper element. These are real assertions against rendered DOM (e.g. the table's parent element carries the wrapper class), and they guard against a future refactor silently dropping the scroll container.

**What is verified manually:** everything in Sections 1 and 2, plus the visual result of Section 3. Verification is done in the browser at a 375px viewport across every route (`/`, `/trades`, `/stats`, `/watchlist`, `/analyze` and its tabs, `/charts`, `/daytrading`, `/settings`), confirming that no page scrolls horizontally at the body level and that the header nav swipes cleanly.

**Non-regression:** the existing suite (660 tests) must stay green. No JSX behavior changes in this work — the only JSX edits are adding wrapper `div`s, which must not disturb any existing query in the test suite.

## Out of scope

- Per-page mobile redesign (card layouts, column hiding, responsive tables).
- Hamburger/drawer navigation.
- Touch-target sizing audit.
- Modifying the four existing `@media` blocks (in `TradeCalendar.css`, `LoginPage.css`, `modal.css`, `TradeRow.css`) — they already handle small screens and stay untouched. Note this does **not** exempt those files entirely: `TradeRow.css:4`'s padding literal is still swapped to `var(--page-pad-x)` per Section 1, since that is a separate declaration from its media query. `TradeCalendar.css` is the one file exempt outright, as it uses `margin` rather than the `32px` padding pattern.
- Chart internals (Recharts sizing, axis label density).

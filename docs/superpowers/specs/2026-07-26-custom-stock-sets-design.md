# Custom Stock Sets for Frontier & Optimizer — Design

## Context

Frontier and Optimizer currently only operate on the user's real open
positions. This adds the ability to build an arbitrary set of stocks —
not limited to what's actually held — and run either tool against it.
Optimizer already has a `mode: 'portfolio' | 'custom'` toggle and an
`incomingSymbols` prop from the original Phase 5 build, but nothing feeds
it and Frontier has no custom-set concept at all.

## Mode toggle + symbol picker (both tabs)

**Frontier** gains a mode toggle (`My Portfolio` / `Custom Set`), matching
Optimizer's existing toggle styling (`.optimizer-mode-toggle` pattern,
reused as `.frontier-mode-toggle`). In Custom Set mode, both tabs render a
symbol picker: chips for each symbol currently in the set, a free-text
"Add symbol" input (uppercased on submit, same pattern as
`FinancialsTab`/`DCFTab`/`ResearchTab`), and a small "×" remove control per
chip. Unlike the portfolio-mode chip picker (which only lists held
positions), this picker accepts any ticker.

**Optimizer** already has the toggle and `incomingSymbols` prop; this phase
adds the same in-tab picker UI to it (currently Custom mode has no way to
edit the symbol list once set — only whatever was passed in via
`incomingSymbols` at mount). The picker's add/remove state becomes the
source of truth for `symbols` in custom mode instead of the static prop.

## Weights (Frontier only)

Optimizer's Monte Carlo simulation doesn't take a starting weight — it
randomly samples weights per iteration regardless of mode. Frontier's
chart, however, plots a "Your Portfolio" reference point that needs a
concrete weight vector. In Custom Set mode, with no real holdings to weight
by market value, that point uses an **equal-weight split** (`1/N` per
symbol) — the same placeholder convention already used by
`PortfolioContext`'s combined-mode frontier for researched-but-unowned
symbols.

## Prices (both tabs)

Frontier's rebalancing table (`actionFor`) and Optimizer's Assumptions
table both need a price per symbol to convert weight% into share counts.
Optimizer already has a "Fetch" button: Finnhub `fetchQuote` per symbol,
150ms pacing between calls, per-symbol error tracking on failure. Frontier
gains the identical button and logic in Custom Set mode (portfolio mode
keeps using `investments.currentPrice` as it does today — no Fetch button
needed there). Newly-added symbols with no price yet show `—` until Fetch
is clicked or a manual override is typed in (both tabs already support
manual price override inputs from the original Phase 5 build).

## Cross-tab hand-off from Sector Browser

`SectorBrowser.jsx` (rendered inside Research's Compare view) gains two
buttons: **Send to Frontier** and **Send to Optimizer**, replacing the
never-wired stub buttons implied by the original app spec (which had
"Send to Optimizer"/"Send to Risk" — Risk is dropped here since it has no
custom-set concept: Risk always reflects your real portfolio, there's no
hypothetical-stocks version of "here's your beta and VaR").

Both buttons call a handler passed down from `AnalyzePage` through
`ResearchTab` through `SectorBrowser`:

```
AnalyzePage
  customSymbols: string[] state
  setCustomSymbols, setTab
    ↓ onSendToFrontier / onSendToOptimizer props
  ResearchTab
    ↓ passed straight through to SectorBrowser
  SectorBrowser
    "Send to Frontier" button → onSendToFrontier(selectedSymbols)
    "Send to Optimizer" button → onSendToOptimizer(selectedSymbols)
```

`AnalyzePage`'s handler implementation for each:
```js
function handleSendToFrontier(symbols) {
  setCustomSymbols(symbols)
  setTab('frontier')
}
function handleSendToOptimizer(symbols) {
  setCustomSymbols(symbols)
  setTab('optimizer')
}
```

`customSymbols` is passed to `FrontierTab`/`OptimizerTab` as an
`incomingSymbols` prop. Each tab, on receiving a non-empty `incomingSymbols`
prop, switches itself into Custom Set mode pre-seeded with those symbols
(a `useEffect` keyed on the `incomingSymbols` reference, mirroring the
existing auto-select-first-stock pattern already used throughout Analyze).
After seeding, the tab's own picker state takes over — `AnalyzePage` doesn't
keep syncing it live; a single hand-off, not two-way binding. Navigating
away and back to Frontier/Optimizer without a new send keeps whatever the
user last had in that tab's own state (component state, not lifted further
than the initial seed).

## Out of scope

- Persisting custom sets to localStorage/Supabase across page reloads —
  in-memory only for this phase, same as every other tab's session-only
  state.
- A "Send to Frontier/Optimizer" entry point from Research's Single view
  or Compare view directly (only Sector Browser gets the buttons, since
  it's the existing multi-select UI — Compare view's symbol list is
  usually 2-4 manually researched tickers, easy to just re-type into the
  target tab's own picker).
- Risk tab custom-set support (explicitly dropped above).

## Testing

- `SectorBrowser.jsx`: new tests for the two send buttons calling their
  respective callback props with the selected symbols.
- `ResearchTab.jsx`: new tests confirming the two handlers pass through
  to `SectorBrowser` unchanged.
- `AnalyzePage.jsx`: new tests for `handleSendToFrontier`/
  `handleSendToOptimizer` — clicking through Research → Sector Browser →
  Send switches to the target tab with symbols pre-seeded (integration-
  style test through the full component tree).
- `FrontierTab.jsx`: mode toggle renders and switches; Custom Set picker
  add/remove; equal-weight reference point when in Custom Set mode; Fetch
  button behavior (reusing Optimizer's existing test pattern); seeding
  from a non-empty `incomingSymbols` prop.
- `OptimizerTab.jsx`: picker add/remove now drives `symbols` in custom
  mode (previously static from `incomingSymbols`); seeding from
  `incomingSymbols` on mount.

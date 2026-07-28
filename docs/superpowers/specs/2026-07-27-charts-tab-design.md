# Charts Tab Design

## Purpose

Add a new top-level "Charts" tab that embeds a TradingView chart for any stock
symbol, with a sidebar of the shared Watchlist's symbols for quick switching.

## Route & Nav

- New route `/charts` in `src/App.jsx`, wrapped in `RequireAuth`, rendering
  `src/pages/ChartsPage.jsx`.
- New `NavLink` in `src/components/Header.jsx`, placed after "Watchlist":
  Home, Stats, Day Trading, Analyze, Watchlist, Charts.

## Components

### `src/components/TradingViewWidget.jsx`

Thin wrapper around TradingView's free "Advanced Chart" embed
(`https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js`).

- Props: `symbol` (string).
- On mount and whenever `symbol` changes: clears the container div's
  `innerHTML` and injects a fresh `<script>` tag with a JSON config
  (`symbol`, `theme: "dark"`, `autosize: true`, etc.), since the TradingView
  embed script does not support live prop updates — it only reads its config
  once at script-injection time. This re-mount-on-change approach is the
  standard way to handle symbol switching with this widget.
- Renders a single `<div className="tradingview-widget-container">` with an
  inner div ref that the script targets.
- No API key or account required — this is TradingView's public embed widget.

### `src/pages/ChartsPage.jsx`

- Uses `useAuth`, `useAccounts`, `useWatchlist` (existing hooks) the same way
  `WatchlistPage.jsx` does, and renders the shared `Header`.
- Local state: `symbol`, initialized from `localStorage` key
  `bt_charts_symbol` (falls back to `'AAPL'` if nothing stored or the stored
  value is empty).
- Search form: single text input + submit button. On submit, uppercases and
  trims the input, sets `symbol` state, and writes it to
  `localStorage['bt_charts_symbol']`.
- Sidebar: built from `useWatchlist`'s `entries`, grouped into a unique,
  watch-count-ranked symbol list via the existing `buildLeaderboard` helper
  (already used by `WatchlistPage.jsx` — sorted by distinct-watcher count
  descending, alphabetical tiebreak). Each row is a button; clicking it sets
  `symbol` state + localStorage the same way the search form does (no
  navigation, no page reload).
- Layout: sidebar (fixed-width, scrollable) on the left, search box + chart
  filling the remaining width on the right — consistent with the app's
  existing dark-theme panel conventions (`--bg-elevated`, `--border`, uppercase
  section-header labels).
- If the watchlist is empty, the sidebar shows a small "No watchlist symbols
  yet" placeholder message instead of an empty list.

## Data Flow

No new Supabase tables, columns, or RLS. `useWatchlist` is already read-only
here (no add/remove UI on this page) and already fetches all users' entries
via the existing `fund_watchlist` RLS policies. All new state (current chart
symbol) is client-side only, in `localStorage`.

## Testing

- `ChartsPage.test.jsx`: search box updates the symbol / localStorage;
  clicking a sidebar row updates the symbol; empty-watchlist placeholder
  renders when there are no entries. `TradingViewWidget` itself is not
  meaningfully unit-testable (it injects a third-party `<script>` tag into
  the DOM) — tests around it will assert the container div renders with the
  right structure and that it re-renders (container cleared + repopulated)
  when the `symbol` prop changes, using a light mock of `document.createElement`
  behavior where needed, or simply asserting the container's presence and
  leaving the actual TradingView script injection unmocked/untested (it's a
  thin, side-effecting wrapper with no branching logic of its own).
- No new hook logic is introduced (reuses `useWatchlist`, `buildLeaderboard`
  as-is), so no new hook-level tests are needed beyond `ChartsPage`'s own.

## Out of Scope (YAGNI)

- No multi-chart / multi-tab layouts.
- No custom indicator presets, saved layouts, or TradingView account linking.
- No server-side symbol validation — invalid symbols are simply whatever
  TradingView's widget shows for an unknown ticker (its own built-in "invalid
  symbol" UI).

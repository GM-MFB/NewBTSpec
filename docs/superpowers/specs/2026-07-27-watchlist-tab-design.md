# Watchlist Tab — Design

## Context

A new top-level "Watchlist" tab: a social hub where any logged-in user can
add stocks to a shared watchlist, see everyone else's, and see a
"Most Watched" leaderboard ranking symbols by how many people have them.
Reuses the existing `fund_watchlist` table exactly as-is (columns: `id`,
`user_id`, `display_name`, `symbol`, `rank`, `note`, `created_at`) — its
RLS already grants every authenticated user read access to all rows and
write access to only their own (`fund watchlist read`: SELECT where
`auth.uid() IS NOT NULL`; `fund watchlist own`: ALL where `auth.uid() =
user_id`). No schema changes needed.

## Data layer

**`src/hooks/useWatchlist.js`** (mirrors the shape of other Supabase
hooks in this codebase, e.g. `useAccounts`):
```js
useWatchlist(userId) -> {
  entries: Array<{ id, userId, displayName, symbol, note, createdAt }>,
  loading: boolean,
  addEntry(symbol, note, displayName) -> Promise<void>,
  removeEntry(id) -> Promise<void>,
}
```
- `entries` loads all rows (no `.eq('user_id', ...)` filter — RLS returns
  everyone's rows to any authenticated reader), ordered by `created_at`
  descending.
- `addEntry` inserts `{ user_id: userId, display_name: displayName,
  symbol: symbol.toUpperCase(), note, rank: 0 }` (`rank` is unused by this
  feature's ranking model — community popularity, not manual per-row
  rank — so it's always inserted as `0`, satisfying the column without
  giving it display meaning), then reloads.
- `removeEntry` deletes by id, then reloads. RLS blocks deleting a row
  that isn't the caller's own — a delete attempt on someone else's entry
  fails silently at the database level; the UI never renders a delete
  button on anyone else's entries in the first place (see below).

**`src/lib/watchlistLeaderboard.js`** — pure, unit-testable:
```js
buildLeaderboard(entries) -> Array<{ symbol: string, count: number, people: string[] }>
```
Groups entries by `symbol`, counts distinct `userId`s per symbol (not
raw row count — if the same user somehow has duplicate rows for a symbol,
they count once), collects the `displayName`s of everyone who has it,
sorted by count descending then symbol alphabetically as a tiebreak.

**`src/lib/fetchWatchlistQuotes.js`** — a small dedicated Finnhub caller
(not reusing the heavier `fetchFundamentals`, which pulls profile/news/
recs/etc. this feature doesn't need):
```js
fetchWatchlistQuote(symbol, apiKey) -> Promise<{ price: number, changePct: number }>
```
Hits Finnhub's `/quote` endpoint directly, maps `c` → `price`, `dp` →
`changePct` (Finnhub already computes day percent change server-side, no
client math needed).

## Component — `src/pages/WatchlistPage.jsx`

New top-level page (same tier as `TradesPage`/`StatsPage`/
`InvestmentsPage`), route `/watchlist`, `<Header>`'s nav gains a
"Watchlist" `NavLink` alongside Home/Day Trading/Stats/Analyze.

- **Add form**: symbol input (uppercased on submit) + optional note
  input + "Add to Watchlist" button. `displayName` passed to `addEntry`
  is `useUserSettings(user.id).displayName || user.email`. If the user
  already has that exact symbol in their own entries, the add is a no-op
  (client-side check against `entries.filter(e => e.userId === userId)`)
  rather than creating a duplicate row.
- **Leaderboard section** ("Most Watched"): renders `buildLeaderboard(entries)`
  as a ranked list — rank number, symbol, live price + colored day % change
  (green/red), count of people who have it, and their names. Prices are
  fetched once per unique symbol across all entries (not per row) via
  `fetchWatchlistQuote`, cached in component state, using the existing
  `finnhubKey` from `useUserSettings`.
- **Individual watchlists section**: entries grouped by `userId`, each
  group headed by that person's `displayName`, listing their symbols +
  notes (reusing the same fetched price cache — no duplicate fetching).
  A delete ("×") control appears only on rows where `entry.userId ===
  currentUserId`.
- Missing-Finnhub-key state: if `finnhubKey` isn't set, the leaderboard
  and individual lists still render (symbols/notes/names are always
  visible — that's core to "see each other's watchlist" regardless of API
  key), just without price/change data for that column (shows `—`).

## Out of scope

- Manual per-row ranking (the existing `rank` column stays unused/always
  `0` — community popularity is the only ranking model this phase
  builds).
- Editing an existing entry's note after creation (delete + re-add
  covers it).
- Any voting/upvote mechanism (that's the separate, pre-existing
  `fund_bull_bear_*` feature, untouched by this phase).

## Testing

- `watchlistLeaderboard.js`: groups by symbol, counts distinct users
  (not raw rows), sorts by count desc then symbol alphabetically,
  collects the right `people` names per symbol.
- `fetchWatchlistQuote`: maps Finnhub's `{c, dp}` response to `{price,
  changePct}`.
- `useWatchlist.js`: loads all entries (no user filter); `addEntry`
  inserts with uppercased symbol and `rank: 0`, then reloads;
  `removeEntry` deletes and reloads.
- `WatchlistPage.jsx`: renders the leaderboard sorted correctly; renders
  individual watchlists grouped by person; add-form submits and skips
  duplicate symbols for the same user; delete button only shows on the
  current user's own rows and calls `removeEntry`; missing Finnhub key
  still shows symbols/notes without crashing.
- `Header.jsx`/`App.jsx`: new "Watchlist" nav link routes to
  `/watchlist`, behind `RequireAuth` like every other page.

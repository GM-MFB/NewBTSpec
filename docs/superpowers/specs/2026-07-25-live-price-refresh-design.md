# Live Price Refresh + Settings Page — Design

## Context

Investment rows show a "current price" (used for Unrealized P&L on stocks and
strike-vs-price coloring on options), but there was no way to set it except
manually per-row at creation time, and no way to update it afterward since
per-row editing was removed. This spec adds a manual "Refresh" action that
pulls live quotes from Finnhub for every open position's underlying symbol,
plus the minimal Settings page needed to hold the user's Finnhub API key
(`user_settings.finnhub_key`, per `database-reference.md`).

## Settings page

Route: `/settings`. Single field: Finnhub API Key (password-masked text
input), a Save button, and inline success/error feedback. Reachable via a
small "⚙" icon button next to the account name in `Header` (all pages that
render `Header` gain this icon; it is not tied to Investments specifically).

### Data layer

`src/hooks/useUserSettings.js`:
- On mount, reads `user_settings` for the current user (`.maybeSingle()`
  per `database-reference.md`'s note on `fund_settings`-style single-row
  fetches), falling back to `localStorage['bt_finnhub_key']` if the row
  doesn't exist yet.
- `saveFinnhubKey(key)` — upserts `user_settings` on `user_id` with
  `finnhub_key: key`, and mirrors the value to
  `localStorage['bt_finnhub_key']`.

## Refresh button

Rendered only on `InvestmentsPage`, next to the existing "+ Add Investment"
button. `Header` gains an optional `onRefresh` prop (and `refreshing`
boolean); when provided, a "↻ Refresh" button appears. `TradesPage` does not
pass this prop, so it never appears there.

### Behavior

1. Collect the set of unique symbols across all currently-open Stock and
   Option investments (both types can share a symbol — e.g. AAPL stock and
   an AAPL covered call).
2. Resolve the Finnhub key: `useUserSettings`'s value, falling back to
   `localStorage['bt_finnhub_key']`.
3. If no key is available, show an inline message: "Add your Finnhub API
   key in Settings to enable price refresh" with a link to `/settings`. Do
   not attempt any fetch.
4. Otherwise, set `refreshing = true` and for each unique symbol call
   `GET https://finnhub.io/api/v1/quote?symbol={symbol}&token={key}`,
   reading `data.c` as the current price.
5. For every investment (Stock or Option) whose symbol matches a fetched
   quote, call `updateInvestment(id, { currentPrice: quote })`.
6. On completion, `refreshing = false`. If any individual symbol's fetch
   failed (network error or Finnhub error payload), collect it into an
   error message shown in the existing error-banner pattern (e.g. "Couldn't
   refresh AAPL, MSFT") without blocking the symbols that succeeded.

### Rate limiting

Finnhub's free tier allows ~60 calls/minute, comfortably above a personal
portfolio's unique-symbol count. No caching layer is introduced (unlike the
existing `financials_cache` table, which exists specifically for Alpha
Vantage's 25-calls/day fundamentals limit — not applicable here).

## Out of scope

- Automatic/background refresh (manual button only).
- Fetching prices for Trades (`/trades` has no current-price concept).
- Any Alpha Vantage integration.
- Historical price charting.

## Testing

Unit tests for `useUserSettings` (mocked Supabase client) and the refresh
logic (mocked `fetch`), following the existing mocked-Supabase-client
pattern used throughout this codebase. Manual smoke test against the live
Supabase project and a real Finnhub key: save a key in Settings, click
Refresh on Investments, confirm current prices update and Unrealized P&L /
strike coloring reflect the fetched values.

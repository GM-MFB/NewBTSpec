# Database Reference — Supabase (BT Speculation)

Portable reference for the Supabase backend used by this app. Hand this file to
Claude when building the new site so the database keeps working exactly as-is —
**do not change table/column names or the client setup**, only the UI on top of it.

## Stack

- **Backend**: [Supabase](https://supabase.com) — Postgres + built-in Auth + Realtime.
- **Client library**: `@supabase/supabase-js` v2 (`^2.103.0`).
- **Auth model**: Supabase email/password auth (`supabase.auth`), one row per
  authenticated user in `auth.users`. All app tables key off `auth.users.id` via a
  `user_id` column (uuid).

## Environment variables

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
```

These are the **same project** — reuse the same Supabase project URL and key in the
new site so all data (accounts, trades, investments, etc.) is shared. If the new
site uses a different framework, rename the vars to match its convention (e.g.
Next.js: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`), but keep the
**values** identical — pointing at a different Supabase project would start with an
empty database.

## Client setup

```js
// utils/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL // or process.env.NEXT_PUBLIC_SUPABASE_URL, etc.
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)
```

One shared client instance, imported everywhere queries are made. No server-side
service-role key is used anywhere in this app — all access goes through the anon
key and is expected to be gated by Postgres Row Level Security (RLS) policies
scoped to `auth.uid()`.

## Auth pattern

```js
// hooks/useAuth.js
supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null)
})
// cleanup: listener.subscription.unsubscribe()
// sign out: supabase.auth.signOut()
```

Reuse this pattern verbatim. `user.id` (uuid) is the value stored in every table's
`user_id` column.

## Row ↔ JS object convention

Every hook follows the same shape: Postgres columns are `snake_case`, JS objects
used in the UI are `camelCase`. Two small mapper functions per table —
`fromRow(dbRow) -> jsObject` and `toRow(jsObject) -> dbRow` — do the conversion on
the way in/out. Keep this convention in the new site so field names stay
predictable; it also means blank strings (`''`) are converted to `null` before
writing to the DB, and back to `''` on read (see `useTrades.js` / `useInvestments.js`
for the exact mapping if you need the full field list).

## Schema

### `accounts`
User's trading/investment "accounts" (supports multiple portfolios per user).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | FK → `auth.users.id` |
| `name` | text | e.g. "Main Account" |
| `cash` | numeric | cash balance, mutated directly (`update({ cash: n })`) |
| `created_at` | timestamptz | default now(), used for ordering |

First login with zero accounts auto-creates one row named `"Main Account"`.
Active account selection is **client-side only** — `localStorage['bt_active_account']`
holds the currently selected `accounts.id`, not stored in the DB.

### `trades` (day-trading journal)

| Column | Type |
|---|---|
| `id` | uuid, PK |
| `account_id` | uuid → `accounts.id` |
| `user_id` | uuid → `auth.users.id` |
| `created_at` | timestamptz |
| `type` | text (`'option'` \| `'futures'`) |
| `symbol` | text |
| `option_type` | text (`'call'` \| `'put'`) |
| `strike` | numeric |
| `expiry` | date/text |
| `direction` | text (`'long'` \| `'short'`) |
| `quantity` | numeric |
| `entry_price` | numeric |
| `exit_price` | numeric |
| `entry_date` | date/text |
| `exit_date` | date/text |
| `status` | text (`'open'` \| `'closed'`) |
| `fees` | numeric |
| `notes` | text |
| `chart_link` | text (URL) |

### `investments` (long-term portfolio positions)

| Column | Type |
|---|---|
| `id` | uuid, PK |
| `account_id` | uuid → `accounts.id` |
| `user_id` | uuid → `auth.users.id` |
| `created_at` | timestamptz |
| `symbol` | text |
| `name` | text |
| `asset_type` | text (`Stock`/`ETF`/`Crypto`/`Bond`/`Option`/`Other`) |
| `sector` | text |
| `shares` | numeric |
| `avg_cost` | numeric |
| `current_price` | numeric |
| `buy_date` | date/text |
| `status` | text (`'open'` \| `'closed'`) |
| `sell_price` | numeric |
| `sell_date` | date/text |
| `stop_loss` | numeric |
| `target_price` | numeric |
| `chart_link` | text |
| `notes` | text |
| `option_type` | text (`'put'` \| `'call'`) |
| `option_direction` | text (`'short'` \| `'long'`) |
| `strike` | numeric |
| `expiry` | date/text |

### `user_settings`
One row per user, upserted on `user_id`.

| Column | Type |
|---|---|
| `user_id` | uuid, PK/unique → `auth.users.id` |
| `finnhub_key` | text (also mirrored to `localStorage['bt_finnhub_key']`) |
| `av_key` | text (Alpha Vantage key, mirrored to `localStorage['bt_av_key']`) |
| `matt_cap_access` | boolean — gates the "MATT Capital" fund section in the UI |
| `display_name` | text |
| `updated_at` | timestamptz |

Upsert pattern: `.upsert({ user_id, ... }, { onConflict: 'user_id' })`.

### `financials_cache`
Shared cache of fetched financial statements, keyed by ticker (not per-user — global
cache to avoid re-hitting Alpha Vantage's 25-calls/day limit).

| Column | Type |
|---|---|
| `ticker` | text, unique — upsert conflict target |
| `data` | jsonb — raw cached payload |
| `fetched_at` | timestamptz |
| `user_id` | uuid, nullable — who populated the cache entry |

### `screener_saves`
Saved stock-screener filter presets.

| Column | Type |
|---|---|
| `id` | uuid, PK |
| `account_id` | text/uuid — supports `'default'` as a sentinel for shared/global saves |
| `user_id` | uuid |
| `name` | text |
| `filters` | jsonb |
| `created_at` | timestamptz |

Special behavior: when `account_id !== 'default'`, the UI also fetches
`account_id = 'default'` saves and merges them in (so "default" account saves act as
shared/global presets visible to every account).

### Fund module tables ("MATT Capital" section, gated by `user_settings.matt_cap_access`)

These are **not per-account** — single shared fund, no `account_id` column.

**`fund_wheel_positions`** — options wheel-strategy positions
| Column | Type |
|---|---|
| `id` | uuid, PK |
| `ticker` | text |
| `type` | text (e.g. `'CSP'`) |
| `strike` | numeric |
| `entry` | date/text |
| `expiry` | date/text |
| `premium` | numeric |
| `contracts` | integer |
| `notes` | text |
| `created_at` | timestamptz |

**`fund_stock_positions`** — plain stock holdings
| Column | Type |
|---|---|
| `id` | uuid, PK |
| `ticker` | text |
| `shares` | numeric |
| `entry_price` | numeric |
| `notes` | text |
| `created_at` | timestamptz |

**`fund_trade_log`** — closed trade history
| Column | Type |
|---|---|
| `id` | uuid, PK |
| `ticker` | text |
| `strategy` | text |
| `entry` | date/text |
| `exit` | date/text |
| `pnl` | numeric |
| `result` | text |
| `strike` | numeric |
| `contracts` | integer |
| `avg_price` | numeric |
| `close_price` | numeric |
| `capital` | numeric |
| `created_at` | timestamptz |

**`fund_settings`** — single-row settings (fetched with `.maybeSingle()`)
| Column | Type |
|---|---|
| `cash` | numeric |
| `start_date` | date/text |

**`fund_watchlist`** — shared collaborative watchlist, ranked
| Column | Type |
|---|---|
| `id` | uuid, PK |
| `user_id` | uuid |
| `display_name` | text |
| `symbol` | text |
| `rank` | integer — drag/reorder position |
| `note` | text, nullable |
| `created_at` | timestamptz |

**`fund_bull_bear_args`** — threaded bull/bear debate posts per symbol
| Column | Type |
|---|---|
| `id` | uuid, PK |
| `symbol` | text |
| `user_id` | uuid |
| `display_name` | text |
| `stance` | text (`'bull'` \| `'bear'`) |
| `body` | text |
| `parent_id` | uuid, nullable — self-FK for threaded replies |
| `created_at` | timestamptz |

**`fund_bull_bear_votes`** — one vote per user per symbol
| Column | Type |
|---|---|
| `id` | uuid, PK |
| `symbol` | text |
| `user_id` | uuid |
| `display_name` | text |
| `vote` | text |
| unique constraint on `(symbol, user_id)` — upsert conflict target |

## Realtime subscriptions

Three tables get live Postgres-changes subscriptions (Supabase Realtime), so
multiple users see updates without refreshing:

```js
supabase
  .channel('any-unique-channel-name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_bull_bear_args' },
    ({ eventType, new: n, old: o }) => { /* handle INSERT/UPDATE/DELETE */ })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_bull_bear_votes' }, /* ... */)
  .subscribe()
```

Used on: `fund_bull_bear_args`, `fund_bull_bear_votes`, `fund_watchlist`. Requires
Realtime to be enabled for these tables in the Supabase dashboard (Database →
Replication) — if the new site is a fresh Supabase project this must be re-enabled,
but since you're keeping the same project, it's already on.

## Multi-account pattern

`accounts` lets one user hold multiple named portfolios. `trades` and `investments`
both scope by `account_id`; switching accounts just re-queries with a different
`account_id`. The **currently selected** account is UI state only
(`localStorage['bt_active_account']`), not persisted server-side — the new site can
implement this however fits its UI, as long as it filters `trades`/`investments`
queries by the chosen `accounts.id`.

## Standard CRUD pattern (reuse as-is)

```js
// Read (scoped to one account)
const { data, error } = await supabase
  .from('trades')
  .select('*')
  .eq('account_id', accountId)
  .order('created_at', { ascending: false })

// Insert
const { data, error } = await supabase
  .from('trades')
  .insert({ account_id, user_id, ...toRow(fields) })
  .select()
  .single()

// Update
await supabase.from('trades').update(toRow(fields)).eq('id', id)

// Delete
await supabase.from('trades').delete().eq('id', id)
```

## What NOT to change

- Table names, column names, and their types — the existing Supabase project's
  schema and RLS policies are already built around these exact names.
- The `snake_case` (DB) ↔ `camelCase` (JS) mapping convention, if you want to reuse
  the existing `fromRow`/`toRow` functions instead of rewriting them.
- The env var **values** (Supabase URL + anon key) — must point at the same project.

Everything else — component structure, styling, state management, routing — is
free to be rebuilt however the new site needs.

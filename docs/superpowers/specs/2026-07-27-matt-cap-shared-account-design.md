# Matt Cap Shared Account — Design

## Context

The old site's "Matt Cap" tab had its own dedicated backend (`fund_*`
tables). This rebuild has none of that — instead, "Matt Cap" becomes a
normal row in the existing `accounts` table, with its trades/investments
living in the same shared `trades`/`investments` tables everyone else
uses. Multiple people get access to it via a `user_settings.matt_cap_access`
boolean flag the user already added to the schema. All gating happens in
Postgres RLS — the app doesn't need to know the flag exists at all.

## Database (already done by the user)

- `accounts` row named `Matt Cap` created (one-time manual insert).
- Three additive RLS policies added: `accounts`/`trades`/`investments`
  each gained a "matt cap shared ..." policy granting access when the
  requesting user has `user_settings.matt_cap_access = true` and the row
  in question belongs to the `Matt Cap` account. These sit alongside the
  existing "own accounts"/"own trades"/"own investments" policies
  (PERMISSIVE, so they OR together — no existing access is restricted).

## App change — `src/hooks/useAccounts.js`

`load()` currently does one query: accounts where `user_id = userId`
(auto-creating a "Main Account" if the user has zero accounts). It gains a
second, independent query:
```js
const { data: sharedAccounts } = await supabase
  .from('accounts')
  .select('*')
  .eq('name', 'Matt Cap')
```
No client-side check of `matt_cap_access` — RLS already ensures this query
returns zero rows for a user without the flag, and the one row for a user
with it. The two result sets are merged and deduped by `id` (covers the
edge case where the owner of the Matt Cap account is also the current
user), then `accounts` state is set from the merged list. The
zero-accounts auto-create-"Main Account" logic still only looks at the
user's **own** accounts (`user_id = userId` query), not the merged list —
a user should still get a personal Main Account even if their only access
is to the shared Matt Cap account.

No other file changes. `Header.jsx`'s account switcher, `useTrades`,
`useInvestments`, and every page that consumes `activeAccountId` already
work generically off whatever's in the `accounts` array — the Matt Cap
account behaves exactly like any other account everywhere else in the
app once it's in that array.

## Out of scope

- Any UI to toggle `matt_cap_access` from within the app — stays a manual
  Supabase table edit, per the user's explicit preference.
- Migrating any data out of the old `fund_*` tables — those are left
  alone, untouched, not read by the app.
- Renaming/deleting the `fund_*` tables — a separate decision for later.

## Testing

- `useAccounts.test.js`: new test — when the Matt Cap query returns a row,
  it appears in `accounts` alongside the user's own accounts; when it
  returns zero rows (simulating a non-flagged user, since RLS would block
  it), only the user's own accounts appear; dedupe when the same account
  id would otherwise appear in both result sets.
- Manual smoke test: flip `matt_cap_access` to `true` for a second test
  user in Supabase, log in as that user, confirm "Matt Cap" appears in
  their account switcher and behaves like a normal account (add a trade,
  add an investment); confirm a user without the flag does not see it.

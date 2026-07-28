# Matt Cap Shared Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `useAccounts` include the shared "Matt Cap" account (already created in Supabase, already gated by RLS via `user_settings.matt_cap_access`) alongside a user's own accounts, with no client-side flag-checking.

**Architecture:** `useAccounts.js`'s `load()` gains a second, independent query for `accounts` where `name = 'Matt Cap'`. RLS already ensures this returns zero rows for a user without access and one row for a user with it. Results are merged with the user's own accounts and deduped by `id`.

**Tech Stack:** React 19, Vitest + @testing-library/react (existing stack, no new dependencies).

## Global Constraints

- No further Supabase schema/RLS changes — those are already done by the user.
- The zero-accounts auto-create-"Main Account" check must only look at the user's own accounts, not the merged list.
- TDD throughout: failing test → implementation → passing test → commit.

---

### Task 1: Merge the Matt Cap shared account into `useAccounts`

**Files:**
- Modify: `src/hooks/useAccounts.js`
- Modify: `src/hooks/useAccounts.test.js`

**Interfaces:** no signature change to `useAccounts(userId)` — same
return shape, `accounts` array just may include one extra row.

- [ ] **Step 1: Write the failing tests**

Replace the existing `mockFrom` helper in `useAccounts.test.js` with a
version that discriminates by the `eq()` column/value so the two
different queries (`user_id = userId` vs `name = 'Matt Cap'`) can return
different results:

```js
function mockFrom({ ownAccounts = [], mattCapAccounts = [], inserted = null }) {
  return vi.fn(() => ({
    select: () => ({
      eq: (col, val) => ({
        order: () => Promise.resolve({
          data: col === 'name' && val === 'Matt Cap' ? mattCapAccounts : ownAccounts,
          error: null,
        }),
      }),
    }),
    insert: () => ({
      select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }),
    }),
  }))
}
```

Update every existing test in the file to call `mockFrom({ ownAccounts: ..., inserted: ... })`
instead of the old `mockFrom({ list: ..., inserted: ... })` shape (rename
the `list` key to `ownAccounts` at each call site — three existing tests
do this).

Add new tests:

```js
it('includes the shared Matt Cap account alongside owned accounts', async () => {
  const owned = [{ id: 'a1', name: 'Main Account' }]
  const mattCap = [{ id: 'mc1', name: 'Matt Cap' }]
  supabase.from.mockReturnValue(mockFrom({ ownAccounts: owned, mattCapAccounts: mattCap }))

  const { result } = renderHook(() => useAccounts('u1'))

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
})

it('does not include Matt Cap when the query returns no rows (RLS blocked)', async () => {
  const owned = [{ id: 'a1', name: 'Main Account' }]
  supabase.from.mockReturnValue(mockFrom({ ownAccounts: owned, mattCapAccounts: [] }))

  const { result } = renderHook(() => useAccounts('u1'))

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.accounts.map((a) => a.id)).toEqual(['a1'])
})

it('dedupes when the current user owns the Matt Cap account', async () => {
  const owned = [{ id: 'a1', name: 'Main Account' }, { id: 'mc1', name: 'Matt Cap' }]
  const mattCap = [{ id: 'mc1', name: 'Matt Cap' }]
  supabase.from.mockReturnValue(mockFrom({ ownAccounts: owned, mattCapAccounts: mattCap }))

  const { result } = renderHook(() => useAccounts('u1'))

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useAccounts`
Expected: FAIL — `load()` doesn't query for Matt Cap yet, and the
existing tests fail too since `mockFrom`'s shape changed (`list` →
`ownAccounts`) without the corresponding hook update.

- [ ] **Step 3: Implement in `src/hooks/useAccounts.js`**

```js
const load = useCallback(async () => {
  if (!userId) return
  setLoading(true)
  const { data: own, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    setLoading(false)
    return
  }

  let ownAccounts = own
  if (ownAccounts.length === 0) {
    const { data: created } = await supabase
      .from('accounts')
      .insert({ user_id: userId, name: 'Main Account', cash: 0 })
      .select()
      .single()
    ownAccounts = [created]
  }

  const { data: mattCapAccounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('name', 'Matt Cap')
    .order('created_at', { ascending: true })

  const ownIds = new Set(ownAccounts.map((a) => a.id))
  const list = [...ownAccounts, ...(mattCapAccounts ?? []).filter((a) => !ownIds.has(a.id))]

  setAccounts(list)
  const stored = localStorage.getItem(STORAGE_KEY)
  const valid = list.find((a) => a.id === stored)
  const active = valid ? valid.id : list[0].id
  setActiveAccountId(active)
  localStorage.setItem(STORAGE_KEY, active)
  setLoading(false)
}, [userId])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useAccounts`
Expected: PASS (all existing tests plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAccounts.js src/hooks/useAccounts.test.js
git commit -m "feat: merge the shared Matt Cap account into useAccounts"
```

---

### Task 2: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (458 existing + 3 new tests from this plan).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

Log in as a user with `user_settings.matt_cap_access = true` — confirm
"Matt Cap" appears in the account switcher alongside their own accounts,
switching to it works, and adding a trade/investment while it's active
works normally. Log in as a user without the flag and confirm it does
not appear.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.

# Screener Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Screener tab — a Finviz filter-builder UI that composes a `finviz.com/screener.ashx?f=...` deep link from ~20 filter dropdowns, with Supabase-backed bookmarking of filter presets via the existing `screener_saves` table.

**Architecture:** A static filter-data module (`finvizFilters.js`) drives the select dropdowns. A pure `buildFinvizUrl` function turns the current selections into a URL. A `useScreenerSaves` hook (mirroring `useAccounts`' load/insert shape) handles preset CRUD against Supabase, including the schema-documented merge of `account_id = 'default'` shared presets. `ScreenerTab.jsx` wires these together.

**Tech Stack:** React 19, Vitest + @testing-library/react, `@supabase/supabase-js` (existing stack, no new dependencies).

## Global Constraints

- No Supabase schema changes — `screener_saves` already exists as documented in `database-reference.md`.
- No live Finviz data fetching — URL-builder/deep-link only.
- TDD throughout: failing test → implementation → passing test → commit, per task.

---

### Task 1: `finvizUrl.js` — URL builder

**Files:**
- Create: `src/lib/finvizUrl.js`
- Create: `src/lib/finvizUrl.test.js`

**Interfaces:**
- Produces: `buildFinvizUrl(filters: { [key]: string }) -> string`. Consumed
  by Task 4 (`ScreenerTab`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { buildFinvizUrl } from './finvizUrl'

describe('buildFinvizUrl', () => {
  it('returns the bare screener URL when no filters are set', () => {
    expect(buildFinvizUrl({})).toBe('https://finviz.com/screener.ashx')
  })

  it('returns the bare screener URL when all filter values are empty strings', () => {
    expect(buildFinvizUrl({ price: '', marketCap: '' })).toBe('https://finviz.com/screener.ashx')
  })

  it('appends a single filter code as the f= param', () => {
    expect(buildFinvizUrl({ price: 'sh_price_u10' })).toBe('https://finviz.com/screener.ashx?f=sh_price_u10')
  })

  it('joins multiple filter codes with commas, dropping empty ones', () => {
    const filters = { price: 'sh_price_u10', marketCap: '', pe: 'fa_pe_u15' }
    expect(buildFinvizUrl(filters)).toBe('https://finviz.com/screener.ashx?f=sh_price_u10,fa_pe_u15')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- finvizUrl`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/finvizUrl.js`**

```js
export function buildFinvizUrl(filters) {
  const codes = Object.values(filters).filter((v) => v)
  if (codes.length === 0) return 'https://finviz.com/screener.ashx'
  return `https://finviz.com/screener.ashx?f=${codes.join(',')}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- finvizUrl`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finvizUrl.js src/lib/finvizUrl.test.js
git commit -m "feat: add buildFinvizUrl to finvizUrl.js"
```

---

### Task 2: `finvizFilters.js` — filter data

**Files:**
- Create: `src/lib/finvizFilters.js`
- Create: `src/lib/finvizFilters.test.js`

**Interfaces:**
- Produces: `FILTER_GROUPS: Array<{ key: string, label: string, options: Array<{ value: string, label: string }> }>`.
  Consumed by Task 4 (`ScreenerTab`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { FILTER_GROUPS } from './finvizFilters'

describe('FILTER_GROUPS', () => {
  it('has at least 18 filter categories', () => {
    expect(FILTER_GROUPS.length).toBeGreaterThanOrEqual(18)
  })

  it('every group has a unique key and starts with an Any option', () => {
    const keys = FILTER_GROUPS.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const group of FILTER_GROUPS) {
      expect(group.options[0]).toEqual({ value: '', label: 'Any' })
    }
  })

  it('every non-Any option has a non-empty value and label', () => {
    for (const group of FILTER_GROUPS) {
      for (const opt of group.options.slice(1)) {
        expect(opt.value.length).toBeGreaterThan(0)
        expect(opt.label.length).toBeGreaterThan(0)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- finvizFilters`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/lib/finvizFilters.js`**

```js
export const FILTER_GROUPS = [
  { key: 'price', label: 'Price', options: [
    { value: '', label: 'Any' },
    { value: 'sh_price_u5', label: 'Under $5' },
    { value: 'sh_price_u10', label: 'Under $10' },
    { value: 'sh_price_u20', label: 'Under $20' },
    { value: 'sh_price_u50', label: 'Under $50' },
    { value: 'sh_price_o5', label: 'Over $5' },
    { value: 'sh_price_o10', label: 'Over $10' },
    { value: 'sh_price_o20', label: 'Over $20' },
    { value: 'sh_price_o50', label: 'Over $50' },
    { value: 'sh_price_o100', label: 'Over $100' },
  ] },
  { key: 'marketCap', label: 'Market Cap', options: [
    { value: '', label: 'Any' },
    { value: 'cap_mega', label: 'Mega ($200B+)' },
    { value: 'cap_large', label: 'Large ($10B-$200B)' },
    { value: 'cap_mid', label: 'Mid ($2B-$10B)' },
    { value: 'cap_small', label: 'Small ($300M-$2B)' },
    { value: 'cap_micro', label: 'Micro ($50M-$300M)' },
    { value: 'cap_nano', label: 'Nano (under $50M)' },
  ] },
  { key: 'pe', label: 'P/E', options: [
    { value: '', label: 'Any' },
    { value: 'fa_pe_profitable', label: 'Profitable (P/E > 0)' },
    { value: 'fa_pe_u15', label: 'Under 15' },
    { value: 'fa_pe_u20', label: 'Under 20' },
    { value: 'fa_pe_u30', label: 'Under 30' },
    { value: 'fa_pe_o15', label: 'Over 15' },
    { value: 'fa_pe_o30', label: 'Over 30' },
  ] },
  { key: 'forwardPE', label: 'Forward P/E', options: [
    { value: '', label: 'Any' },
    { value: 'fa_fpe_u15', label: 'Under 15' },
    { value: 'fa_fpe_u20', label: 'Under 20' },
    { value: 'fa_fpe_o15', label: 'Over 15' },
    { value: 'fa_fpe_o30', label: 'Over 30' },
  ] },
  { key: 'peg', label: 'PEG', options: [
    { value: '', label: 'Any' },
    { value: 'fa_peg_u1', label: 'Under 1' },
    { value: 'fa_peg_u2', label: 'Under 2' },
    { value: 'fa_peg_o1', label: 'Over 1' },
  ] },
  { key: 'dividendYield', label: 'Dividend Yield', options: [
    { value: '', label: 'Any' },
    { value: 'fa_div_none', label: 'None (0%)' },
    { value: 'fa_div_pos', label: 'Positive (>0%)' },
    { value: 'fa_div_o3', label: 'Over 3%' },
    { value: 'fa_div_o5', label: 'Over 5%' },
    { value: 'fa_div_high', label: 'Very High (>5%)' },
  ] },
  { key: 'payoutRatio', label: 'Payout Ratio', options: [
    { value: '', label: 'Any' },
    { value: 'fa_payoutratio_none', label: 'None (0%)' },
    { value: 'fa_payoutratio_u50', label: 'Under 50%' },
    { value: 'fa_payoutratio_o50', label: 'Over 50%' },
  ] },
  { key: 'beta', label: 'Beta', options: [
    { value: '', label: 'Any' },
    { value: 'sh_beta_u0.5', label: 'Under 0.5' },
    { value: 'sh_beta_u1', label: 'Under 1' },
    { value: 'sh_beta_o1', label: 'Over 1' },
    { value: 'sh_beta_o1.5', label: 'Over 1.5' },
    { value: 'sh_beta_o2', label: 'Over 2' },
  ] },
  { key: 'avgVolume', label: 'Avg Volume', options: [
    { value: '', label: 'Any' },
    { value: 'sh_avgvol_u100', label: 'Under 100K' },
    { value: 'sh_avgvol_o100', label: 'Over 100K' },
    { value: 'sh_avgvol_o500', label: 'Over 500K' },
    { value: 'sh_avgvol_o1000', label: 'Over 1M' },
  ] },
  { key: 'shortInterest', label: 'Short Interest', options: [
    { value: '', label: 'Any' },
    { value: 'sh_short_low', label: 'Low (<5%)' },
    { value: 'sh_short_o5', label: 'Over 5%' },
    { value: 'sh_short_o20', label: 'Over 20%' },
    { value: 'sh_short_high', label: 'High (>20%)' },
  ] },
  { key: 'perf52w', label: '52-Week Performance', options: [
    { value: '', label: 'Any' },
    { value: 'ta_highlow52w_nh', label: 'New High' },
    { value: 'ta_highlow52w_nl', label: 'New Low' },
    { value: 'ta_perf_52wup', label: 'Up over past year' },
    { value: 'ta_perf_52wdown', label: 'Down over past year' },
  ] },
  { key: 'perfYtd', label: 'YTD Performance', options: [
    { value: '', label: 'Any' },
    { value: 'ta_perf_ytdup', label: 'Positive YTD' },
    { value: 'ta_perf_ytddown', label: 'Negative YTD' },
  ] },
  { key: 'analystRecom', label: 'Analyst Recom.', options: [
    { value: '', label: 'Any' },
    { value: 'an_recom_strongbuy', label: 'Strong Buy' },
    { value: 'an_recom_buybetter', label: 'Buy or better' },
    { value: 'an_recom_hold', label: 'Hold' },
  ] },
  { key: 'optionable', label: 'Optionable', options: [
    { value: '', label: 'Any' },
    { value: 'sh_opt_option', label: 'Optionable' },
  ] },
  { key: 'shortable', label: 'Shortable', options: [
    { value: '', label: 'Any' },
    { value: 'sh_short_shortable', label: 'Shortable' },
  ] },
  { key: 'sector', label: 'Sector', options: [
    { value: '', label: 'Any' },
    { value: 'sec_technology', label: 'Technology' },
    { value: 'sec_healthcare', label: 'Healthcare' },
    { value: 'sec_financial', label: 'Financial' },
    { value: 'sec_energy', label: 'Energy' },
    { value: 'sec_industrials', label: 'Industrials' },
    { value: 'sec_consumercyclical', label: 'Consumer Cyclical' },
    { value: 'sec_consumerdefensive', label: 'Consumer Defensive' },
    { value: 'sec_realestate', label: 'Real Estate' },
    { value: 'sec_basicmaterials', label: 'Basic Materials' },
    { value: 'sec_communicationservices', label: 'Communication Services' },
    { value: 'sec_utilities', label: 'Utilities' },
  ] },
  { key: 'country', label: 'Geography', options: [
    { value: '', label: 'Any' },
    { value: 'geo_usa', label: 'USA' },
    { value: 'geo_notusa', label: 'Not USA (foreign)' },
    { value: 'geo_china', label: 'China' },
    { value: 'geo_europe', label: 'Europe' },
  ] },
  { key: 'exchange', label: 'Exchange', options: [
    { value: '', label: 'Any' },
    { value: 'exch_nyse', label: 'NYSE' },
    { value: 'exch_nasd', label: 'NASDAQ' },
    { value: 'exch_amex', label: 'AMEX' },
  ] },
  { key: 'index', label: 'Index', options: [
    { value: '', label: 'Any' },
    { value: 'idx_sp500', label: 'S&P 500' },
    { value: 'idx_dji', label: 'Dow Jones' },
    { value: 'idx_russell2000', label: 'Russell 2000' },
    { value: 'idx_nasdaq100', label: 'NASDAQ 100' },
  ] },
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- finvizFilters`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finvizFilters.js src/lib/finvizFilters.test.js
git commit -m "feat: add FILTER_GROUPS filter data to finvizFilters.js"
```

---

### Task 3: `useScreenerSaves` hook

**Files:**
- Create: `src/hooks/useScreenerSaves.js`
- Create: `src/hooks/useScreenerSaves.test.js`

**Interfaces:**
- Produces: `useScreenerSaves(accountId, userId) -> { saves, loading, savePreset(name, filters), deletePreset(id) }`.
  Consumed by Task 5 (`ScreenerTab` presets).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useScreenerSaves } from './useScreenerSaves'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockScreenerFrom({ ownSaves = [], defaultSaves = [], inserted = null }) {
  return vi.fn(() => ({
    select: () => ({
      eq: (col, val) => ({
        order: () => Promise.resolve({ data: val === 'default' ? defaultSaves : ownSaves, error: null }),
      }),
    }),
    insert: (row) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'new1', ...row }, error: null }) }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }))
}

describe('useScreenerSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads own-account saves', async () => {
    const ownSaves = [{ id: 's1', name: 'Cheap Tech', filters: { sector: 'sec_technology' } }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.saves).toEqual(ownSaves)
  })

  it('merges in default-account saves when accountId is not "default"', async () => {
    const ownSaves = [{ id: 's1', name: 'Own', filters: {} }]
    const defaultSaves = [{ id: 's2', name: 'Shared', filters: {} }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves, defaultSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.saves.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('does not double-fetch default saves when accountId is already "default"', async () => {
    const ownSaves = [{ id: 's1', name: 'Global', filters: {} }]
    const fromSpy = vi.fn(mockScreenerFrom({ ownSaves }))
    supabase.from = fromSpy

    const { result } = renderHook(() => useScreenerSaves('default', 'u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.saves).toEqual(ownSaves)
  })

  it('savePreset inserts and reloads', async () => {
    const ownSaves = [{ id: 's1', name: 'Existing', filters: {} }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.savePreset('New Preset', { price: 'sh_price_u10' })
    })

    expect(supabase.from).toHaveBeenCalledWith('screener_saves')
  })

  it('deletePreset deletes and reloads', async () => {
    const ownSaves = [{ id: 's1', name: 'Existing', filters: {} }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deletePreset('s1')
    })

    expect(result.current.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useScreenerSaves`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement in `src/hooks/useScreenerSaves.js`**

```js
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

export function useScreenerSaves(accountId, userId) {
  const [saves, setSaves] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)

    const { data: own } = await supabase
      .from('screener_saves')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    let merged = own ?? []

    if (accountId !== 'default') {
      const { data: shared } = await supabase
        .from('screener_saves')
        .select('*')
        .eq('account_id', 'default')
        .order('created_at', { ascending: false })

      const ownIds = new Set(merged.map((s) => s.id))
      merged = [...merged, ...(shared ?? []).filter((s) => !ownIds.has(s.id))]
    }

    setSaves(merged)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  async function savePreset(name, filters) {
    const { error } = await supabase
      .from('screener_saves')
      .insert({ account_id: accountId, user_id: userId, name, filters })
      .select()
      .single()
    if (error) throw error
    await load()
  }

  async function deletePreset(id) {
    const { error } = await supabase.from('screener_saves').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  return { saves, loading, savePreset, deletePreset }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useScreenerSaves`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScreenerSaves.js src/hooks/useScreenerSaves.test.js
git commit -m "feat: add useScreenerSaves hook for preset CRUD"
```

---

### Task 4: `ScreenerTab.jsx` — filter grid + URL builder

**Files:**
- Create: `src/components/analysis/ScreenerTab.jsx`
- Create: `src/components/analysis/ScreenerTab.css`
- Create: `src/components/analysis/ScreenerTab.test.jsx`

**Interfaces:**
- Consumes: `FILTER_GROUPS` (Task 2), `buildFinvizUrl` (Task 1).
- Props: `{ accountId, userId }`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScreenerTab from './ScreenerTab'
import { supabase } from '../../utils/supabase'

vi.mock('../../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockScreenerFrom({ ownSaves = [], defaultSaves = [] } = {}) {
  return vi.fn(() => ({
    select: () => ({
      eq: (col, val) => ({
        order: () => Promise.resolve({ data: val === 'default' ? defaultSaves : ownSaves, error: null }),
      }),
    }),
    insert: (row) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'new1', ...row }, error: null }) }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }))
}

describe('ScreenerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.from.mockImplementation(mockScreenerFrom())
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('renders a select for each filter group', () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    expect(screen.getByLabelText(/^price$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^market cap$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^sector$/i)).toBeInTheDocument()
  })

  it('shows the bare Finviz URL with no filters selected', () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    expect(screen.getByText('https://finviz.com/screener.ashx')).toBeInTheDocument()
  })

  it('updates the displayed URL when a filter is selected', async () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')
    expect(screen.getByText('https://finviz.com/screener.ashx?f=sh_price_u10')).toBeInTheDocument()
  })

  it('copies the current URL when Copy URL is clicked', async () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')
    await userEvent.click(screen.getByRole('button', { name: /copy url/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://finviz.com/screener.ashx?f=sh_price_u10')
  })

  it('the Open in Finviz link href matches the built URL', async () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')
    expect(screen.getByRole('link', { name: /open in finviz/i })).toHaveAttribute(
      'href',
      'https://finviz.com/screener.ashx?f=sh_price_u10',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ScreenerTab`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/components/analysis/ScreenerTab.jsx`**

```jsx
import { useState } from 'react'
import './ScreenerTab.css'
import { FILTER_GROUPS } from '../../lib/finvizFilters'
import { buildFinvizUrl } from '../../lib/finvizUrl'
import { useScreenerSaves } from '../../hooks/useScreenerSaves'

export default function ScreenerTab({ accountId, userId }) {
  const [filters, setFilters] = useState({})
  const { saves, savePreset, deletePreset } = useScreenerSaves(accountId, userId)
  const [presetName, setPresetName] = useState('')

  const url = buildFinvizUrl(filters)

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!presetName.trim()) return
    await savePreset(presetName.trim(), filters)
    setPresetName('')
  }

  function applyPreset(preset) {
    setFilters(preset.filters ?? {})
  }

  return (
    <div className="screener-tab">
      <div className="screener-filter-grid">
        {FILTER_GROUPS.map((group) => (
          <label key={group.key} htmlFor={`screener-${group.key}`}>
            {group.label}
            <select
              id={`screener-${group.key}`}
              value={filters[group.key] ?? ''}
              onChange={(e) => setFilter(group.key, e.target.value)}
            >
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="screener-url-bar">
        <span className="screener-url mono">{url}</span>
        <button type="button" onClick={() => navigator.clipboard.writeText(url)}>Copy URL</button>
        <a href={url} target="_blank" rel="noreferrer">Open in Finviz ↗</a>
      </div>

      <section className="screener-presets">
        <h2>Saved Presets</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
          <label htmlFor="screenerPresetName">Preset name</label>
          <input
            id="screenerPresetName"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button type="submit">Save</button>
        </form>

        <ul className="screener-preset-list">
          {saves.map((preset) => (
            <li key={preset.id}>
              <span>{preset.name}</span>
              <button type="button" onClick={() => applyPreset(preset)}>Apply</button>
              <button type="button" onClick={() => deletePreset(preset.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Add `src/components/analysis/ScreenerTab.css`**

```css
.screener-tab {
  padding: 20px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.screener-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}

.screener-filter-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.screener-filter-grid select {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 400;
  text-transform: none;
}

.screener-url-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
}

.screener-url {
  flex: 1;
  min-width: 200px;
  font-size: 12px;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}

.screener-presets h2 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.screener-presets form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}

.screener-presets form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.screener-presets form input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 13px;
}

.screener-preset-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.screener-preset-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.screener-preset-list li span {
  flex: 1;
  font-weight: 600;
  color: var(--text);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- ScreenerTab`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/ScreenerTab.jsx src/components/analysis/ScreenerTab.css src/components/analysis/ScreenerTab.test.jsx
git commit -m "feat: implement ScreenerTab filter grid and Finviz URL builder"
```

---

### Task 5: `ScreenerTab.jsx` — saved presets (save/apply/delete)

**Files:**
- Modify: `src/components/analysis/ScreenerTab.test.jsx`

**Interfaces:** none new — this task verifies wiring already implemented in
Task 4 (`useScreenerSaves`, `savePreset`/`applyPreset`/`deletePreset`).

- [ ] **Step 1: Write the failing tests**

```jsx
it('lists saved presets and applies one when Apply is clicked', async () => {
  supabase.from.mockImplementation(mockScreenerFrom({
    ownSaves: [{ id: 's1', name: 'Cheap Tech', filters: { price: 'sh_price_u10', sector: 'sec_technology' } }],
  }))
  render(<ScreenerTab accountId="a1" userId="u1" />)

  expect(await screen.findByText('Cheap Tech')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /apply/i }))

  expect(screen.getByLabelText(/^price$/i)).toHaveValue('sh_price_u10')
  expect(screen.getByLabelText(/^sector$/i)).toHaveValue('sec_technology')
})

it('saves the current filters under the typed preset name', async () => {
  render(<ScreenerTab accountId="a1" userId="u1" />)
  await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')

  await userEvent.type(screen.getByLabelText(/preset name/i), 'My Filter')
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

  expect(supabase.from).toHaveBeenCalledWith('screener_saves')
})

it('deletes a preset when Delete is clicked', async () => {
  supabase.from.mockImplementation(mockScreenerFrom({
    ownSaves: [{ id: 's1', name: 'Cheap Tech', filters: {} }],
  }))
  render(<ScreenerTab accountId="a1" userId="u1" />)

  expect(await screen.findByText('Cheap Tech')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))

  expect(supabase.from).toHaveBeenCalledWith('screener_saves')
})
```

Add these inside the existing `describe('ScreenerTab', ...)` block.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ScreenerTab`
Expected: PASS or FAIL depending on whether Task 4's implementation
already satisfies this — run it first. If any assertion fails (e.g. select
value not reflecting the applied preset), fix `ScreenerTab.jsx`'s
`applyPreset`/`setFilters` wiring from Task 4 to match; no new production
code paths are expected beyond what Task 4 already built.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- ScreenerTab`
Expected: PASS (8 tests total).

- [ ] **Step 4: Commit**

```bash
git add src/components/analysis/ScreenerTab.test.jsx
git commit -m "test: verify ScreenerTab preset save/apply/delete flow"
```

---

### Task 6: Page wiring

**Files:**
- Modify: `src/pages/AnalyzePage.jsx`
- Modify: `src/pages/AnalyzePage.test.jsx`

- [ ] **Step 1: Wire `ScreenerTab` into `AnalyzePage.jsx`**

Import `ScreenerTab`, render it for `tab === 'screener'` with
`accountId={activeAccountId} userId={user?.id}`, replacing the
placeholder branch for that tab specifically (the placeholder JSX/function
stays in the file for any future unbuilt tab).

```jsx
{tab === 'screener' && <ScreenerTab accountId={activeAccountId} userId={user?.id} />}
{!['financials', 'research', 'dcf', 'risk', 'screener'].includes(tab) && (
  <AnalyzeTabPlaceholder label={TABS.find((t) => t.key === tab).label} />
)}
```

- [ ] **Step 2: Update `AnalyzePage.test.jsx`**

Remove the "shows a Coming soon placeholder for an unbuilt tab" test —
with Screener built, all 5 `TABS` entries render real tabs and there's no
remaining unbuilt tab to click through to exercise that branch. Add a
mock for `../hooks/useScreenerSaves` (or `../utils/supabase`, whichever
is simpler given the existing mock setup) so rendering the Screener tab in
`AnalyzePage`'s tests doesn't hit real Supabase calls — check what the
existing `mockCommon()` already mocks before adding a new one.

```jsx
vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn(() => ({
  select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
})) } }))
```

Add a new test:

```jsx
it('renders the Screener tab', async () => {
  mockCommon()
  render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: /^screener$/i }))
  expect(screen.getByText('https://finviz.com/screener.ashx')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- AnalyzePage`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AnalyzePage.jsx src/pages/AnalyzePage.test.jsx
git commit -m "feat: wire Screener tab into AnalyzePage"
```

---

### Task 7: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (432 existing + new tests from this plan).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → Screener: select a few filters, confirm the URL updates
live and Copy URL/Open in Finviz both work against a real filter
combination (verify the opened Finviz page shows the expected filters
applied); save a preset, reload the page, confirm it's still listed;
click Apply and confirm the selects restore; click Delete and confirm it
disappears.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.

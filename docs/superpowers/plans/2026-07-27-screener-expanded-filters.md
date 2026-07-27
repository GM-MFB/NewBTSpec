# Screener Expanded Filters & Grouped Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~21 more real Finviz filter categories (growth, margins, ownership, technical indicators) to the Screener, and reorganize the resulting ~40 dropdowns into three collapsible Descriptive/Fundamental/Technical sections so the page stays scannable.

**Architecture:** Each `FILTER_GROUPS` entry gains a `category` field. `ScreenerTab` renders three `<details open>` sections (the same collapsible pattern `SectorBrowser` already uses), each containing that category's filter grid. No changes to `buildFinvizUrl` or `useScreenerSaves` — filter values still flow through the same flat `filters` state object.

**Tech Stack:** React 19, Vitest + @testing-library/react (existing stack, no new dependencies).

## Global Constraints

- No changes to `buildFinvizUrl`/`useScreenerSaves` behavior or interfaces.
- All three category sections default open (not collapsed).
- TDD throughout: failing test → implementation → passing test → commit.

---

### Task 1: Add `category` field to existing 19 filter groups

**Files:**
- Modify: `src/lib/finvizFilters.js`
- Modify: `src/lib/finvizFilters.test.js`

**Interfaces:**
- `FILTER_GROUPS` entries gain a `category: 'descriptive' | 'fundamental' | 'technical'` field. Consumed by Task 3 (`ScreenerTab`).

- [ ] **Step 1: Write the failing test**

Add to `finvizFilters.test.js`:

```js
it('every group has a valid category', () => {
  const validCategories = ['descriptive', 'fundamental', 'technical']
  for (const group of FILTER_GROUPS) {
    expect(validCategories).toContain(group.category)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- finvizFilters`
Expected: FAIL — no group has a `category` field yet.

- [ ] **Step 3: Add `category` to each existing group in `finvizFilters.js`**

Add `category: 'descriptive'` to: `price`, `marketCap`, `avgVolume`,
`shortInterest`, `analystRecom`, `optionable`, `shortable`, `sector`,
`country`, `exchange`, `index`.

Add `category: 'fundamental'` to: `pe`, `forwardPE`, `peg`,
`dividendYield`, `payoutRatio`.

Add `category: 'technical'` to: `beta`, `perf52w`, `perfYtd`.

Example (apply the same pattern to every group listed above):
```js
{ key: 'price', label: 'Price', category: 'descriptive', options: [
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- finvizFilters`
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finvizFilters.js src/lib/finvizFilters.test.js
git commit -m "feat: add category field to existing Screener filter groups"
```

---

### Task 2: Add 21 new filter groups

**Files:**
- Modify: `src/lib/finvizFilters.js`
- Modify: `src/lib/finvizFilters.test.js`

**Interfaces:** none new — extends `FILTER_GROUPS` with more entries of
the same shape.

- [ ] **Step 1: Write the failing test**

Add to `finvizFilters.test.js`:

```js
it('has at least 38 filter categories after the expansion', () => {
  expect(FILTER_GROUPS.length).toBeGreaterThanOrEqual(38)
})

it('includes the new fundamental and technical groups', () => {
  const keys = FILTER_GROUPS.map((g) => g.key)
  expect(keys).toEqual(expect.arrayContaining([
    'epsGrowthThisYear', 'epsGrowthNextYear', 'salesGrowth5y', 'roe', 'roa',
    'debtEquity', 'grossMargin', 'operatingMargin', 'netMargin',
    'priceBook', 'priceSales', 'priceCashFlow', 'insiderOwn', 'instOwn',
    'rsi', 'sma20', 'sma50', 'sma200', 'highLow50d', 'changeToday', 'relVolume',
  ]))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- finvizFilters`
Expected: FAIL — new keys don't exist yet, count is still 19.

- [ ] **Step 3: Append the 21 new groups to `FILTER_GROUPS` in `finvizFilters.js`**

Add these entries at the end of the `FILTER_GROUPS` array, before the
closing `]`:

```js
  { key: 'epsGrowthThisYear', label: 'EPS Growth This Year', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_epsyoy_pos', label: 'Positive (>0%)' },
    { value: 'fa_epsyoy_o10', label: 'Over 10%' },
    { value: 'fa_epsyoy_o20', label: 'Over 20%' },
    { value: 'fa_epsyoy_o30', label: 'Over 30%' },
  ] },
  { key: 'epsGrowthNextYear', label: 'EPS Growth Next Year', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_epsyoy1_pos', label: 'Positive (>0%)' },
    { value: 'fa_epsyoy1_o10', label: 'Over 10%' },
    { value: 'fa_epsyoy1_o20', label: 'Over 20%' },
  ] },
  { key: 'salesGrowth5y', label: 'Sales Growth (5Y)', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_sales5years_pos', label: 'Positive (>0%)' },
    { value: 'fa_sales5years_o10', label: 'Over 10%' },
    { value: 'fa_sales5years_o20', label: 'Over 20%' },
  ] },
  { key: 'roe', label: 'Return on Equity', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_roe_pos', label: 'Positive (>0%)' },
    { value: 'fa_roe_o10', label: 'Over 10%' },
    { value: 'fa_roe_o20', label: 'Over 20%' },
    { value: 'fa_roe_o30', label: 'Over 30%' },
  ] },
  { key: 'roa', label: 'Return on Assets', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_roa_pos', label: 'Positive (>0%)' },
    { value: 'fa_roa_o5', label: 'Over 5%' },
    { value: 'fa_roa_o10', label: 'Over 10%' },
    { value: 'fa_roa_o15', label: 'Over 15%' },
  ] },
  { key: 'debtEquity', label: 'Debt/Equity', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_debteq_u1', label: 'Under 1' },
    { value: 'fa_debteq_u0.5', label: 'Under 0.5' },
    { value: 'fa_debteq_low', label: 'Low (<0.1)' },
  ] },
  { key: 'grossMargin', label: 'Gross Margin', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_grossmargin_pos', label: 'Positive (>0%)' },
    { value: 'fa_grossmargin_o30', label: 'Over 30%' },
    { value: 'fa_grossmargin_o50', label: 'Over 50%' },
    { value: 'fa_grossmargin_o70', label: 'Over 70%' },
  ] },
  { key: 'operatingMargin', label: 'Operating Margin', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_opermargin_pos', label: 'Positive (>0%)' },
    { value: 'fa_opermargin_o10', label: 'Over 10%' },
    { value: 'fa_opermargin_o20', label: 'Over 20%' },
    { value: 'fa_opermargin_o30', label: 'Over 30%' },
  ] },
  { key: 'netMargin', label: 'Net Profit Margin', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_netmargin_pos', label: 'Positive (>0%)' },
    { value: 'fa_netmargin_o10', label: 'Over 10%' },
    { value: 'fa_netmargin_o20', label: 'Over 20%' },
  ] },
  { key: 'priceBook', label: 'Price/Book', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_pb_u1', label: 'Under 1' },
    { value: 'fa_pb_u3', label: 'Under 3' },
    { value: 'fa_pb_u5', label: 'Under 5' },
  ] },
  { key: 'priceSales', label: 'Price/Sales', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_ps_u1', label: 'Under 1' },
    { value: 'fa_ps_u2', label: 'Under 2' },
    { value: 'fa_ps_u5', label: 'Under 5' },
  ] },
  { key: 'priceCashFlow', label: 'Price/Cash Flow', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'fa_pc_u5', label: 'Under 5' },
    { value: 'fa_pc_u10', label: 'Under 10' },
    { value: 'fa_pc_u20', label: 'Under 20' },
  ] },
  { key: 'insiderOwn', label: 'Insider Ownership', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'sh_insiderown_low', label: 'Low (>0%)' },
    { value: 'sh_insiderown_o10', label: 'Over 10%' },
    { value: 'sh_insiderown_o30', label: 'Over 30%' },
    { value: 'sh_insiderown_high', label: 'High (>50%)' },
  ] },
  { key: 'instOwn', label: 'Institutional Ownership', category: 'fundamental', options: [
    { value: '', label: 'Any' },
    { value: 'sh_instown_low', label: 'Low (>0%)' },
    { value: 'sh_instown_o50', label: 'Over 50%' },
    { value: 'sh_instown_o90', label: 'Over 90%' },
  ] },
  { key: 'rsi', label: 'RSI (14)', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_rsi_os30', label: 'Oversold (<30)' },
    { value: 'ta_rsi_ob70', label: 'Overbought (>70)' },
    { value: 'ta_rsi_nos40', label: 'Not Oversold (>40)' },
    { value: 'ta_rsi_nob60', label: 'Not Overbought (<60)' },
  ] },
  { key: 'sma20', label: 'vs 20-Day SMA', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_sma20_pa', label: 'Price Above SMA20' },
    { value: 'ta_sma20_pb', label: 'Price Below SMA20' },
  ] },
  { key: 'sma50', label: 'vs 50-Day SMA', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_sma50_pa', label: 'Price Above SMA50' },
    { value: 'ta_sma50_pb', label: 'Price Below SMA50' },
  ] },
  { key: 'sma200', label: 'vs 200-Day SMA', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_sma200_pa', label: 'Price Above SMA200' },
    { value: 'ta_sma200_pb', label: 'Price Below SMA200' },
  ] },
  { key: 'highLow50d', label: '50-Day High/Low', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_highlow50d_nh', label: 'New High' },
    { value: 'ta_highlow50d_nl', label: 'New Low' },
    { value: 'ta_highlow50d_b0to10h', label: 'Within 10% of High' },
  ] },
  { key: 'changeToday', label: 'Change (Today)', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_change_u', label: 'Up' },
    { value: 'ta_change_u5', label: 'Up 5%+' },
    { value: 'ta_change_d', label: 'Down' },
    { value: 'ta_change_d5', label: 'Down 5%+' },
  ] },
  { key: 'relVolume', label: 'Relative Volume', category: 'technical', options: [
    { value: '', label: 'Any' },
    { value: 'ta_relvol_o1.5', label: 'Over 1.5x' },
    { value: 'ta_relvol_o2', label: 'Over 2x' },
    { value: 'ta_relvol_o3', label: 'Over 3x' },
    { value: 'ta_relvol_u1', label: 'Under 1x' },
  ] },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- finvizFilters`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finvizFilters.js src/lib/finvizFilters.test.js
git commit -m "feat: add 21 new fundamental and technical Screener filter categories"
```

---

### Task 3: Grouped collapsible layout in `ScreenerTab`

**Files:**
- Modify: `src/components/analysis/ScreenerTab.jsx`
- Modify: `src/components/analysis/ScreenerTab.css`
- Modify: `src/components/analysis/ScreenerTab.test.jsx`

**Interfaces:** none new — presentation-only change, `filters` state shape
and all existing props/behavior unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `ScreenerTab.test.jsx`:

```jsx
it('renders three category sections with the right headings', () => {
  render(<ScreenerTab accountId="a1" userId="u1" />)
  expect(screen.getByText('Descriptive')).toBeInTheDocument()
  expect(screen.getByText('Fundamental')).toBeInTheDocument()
  expect(screen.getByText('Technical')).toBeInTheDocument()
})

it('places a newly-added filter under its own category section', () => {
  render(<ScreenerTab accountId="a1" userId="u1" />)
  const technicalSection = screen.getByText('Technical').closest('details')
  expect(technicalSection).toContainElement(screen.getByLabelText(/^rsi/i))

  const fundamentalSection = screen.getByText('Fundamental').closest('details')
  expect(fundamentalSection).toContainElement(screen.getByLabelText(/return on equity/i))
})

it('selecting a newly-added filter updates the built URL', async () => {
  render(<ScreenerTab accountId="a1" userId="u1" />)
  await userEvent.selectOptions(screen.getByLabelText(/^rsi/i), 'ta_rsi_os30')
  expect(screen.getByText('https://finviz.com/screener.ashx?f=ta_rsi_os30')).toBeInTheDocument()
})
```

Add these inside the existing `describe('ScreenerTab', ...)` block.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ScreenerTab`
Expected: FAIL — no category sections exist yet, everything is one flat
grid.

- [ ] **Step 3: Implement in `src/components/analysis/ScreenerTab.jsx`**

Add a category-labels constant above the component, and replace the single
`.screener-filter-grid` block with three per-category `<details>`
sections:

```jsx
const CATEGORY_ORDER = ['descriptive', 'fundamental', 'technical']
const CATEGORY_LABELS = { descriptive: 'Descriptive', fundamental: 'Fundamental', technical: 'Technical' }
```

Replace:
```jsx
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
```
with:
```jsx
      {CATEGORY_ORDER.map((cat) => (
        <details key={cat} open className="screener-category">
          <summary>{CATEGORY_LABELS[cat]}</summary>
          <div className="screener-filter-grid">
            {FILTER_GROUPS.filter((g) => g.category === cat).map((group) => (
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
        </details>
      ))}
```

- [ ] **Step 4: Add CSS for the category sections**

```css
.screener-category {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 16px 16px;
}

.screener-category summary {
  cursor: pointer;
  padding: 12px 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.screener-category .screener-filter-grid {
  padding-top: 4px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- ScreenerTab`
Expected: PASS (all existing tests plus the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/analysis/ScreenerTab.jsx src/components/analysis/ScreenerTab.css src/components/analysis/ScreenerTab.test.jsx
git commit -m "feat: group Screener filters into collapsible Descriptive/Fundamental/Technical sections"
```

---

### Task 4: Full suite + `netlify dev` smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (452 existing + new tests from this plan).

- [ ] **Step 2: Restart `netlify dev`, manual smoke test**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

At `/analyze` → Screener: confirm all three sections (Descriptive/
Fundamental/Technical) render open by default with the right filters
under each; select a few new filters (e.g. RSI, ROE, Debt/Equity) across
different sections and confirm the built URL includes all of them
correctly comma-joined; confirm existing filters (Price, Sector, etc.)
still work exactly as before; save a preset with a mix of old and new
filters, reload, and confirm Apply restores all of them correctly across
sections.

- [ ] **Step 3: Report completion**

No commit needed for this task unless smoke testing surfaces a bug — fix
as a new small commit and re-run Step 1.

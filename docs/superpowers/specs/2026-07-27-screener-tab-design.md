# Screener Tab — Design

## Context

The last unbuilt tab in Analyze. Per `analysis-tab-spec.md` §12, the
original Screener is **not a live-data screener** — it's a Finviz
filter-builder UI: pick values across ~20 filter categories, and the app
composes a `finviz.com/screener.ashx?f=...` deep link that opens on the
external Finviz site. Filter presets are bookmarkable via the existing
`screener_saves` Supabase table (already in the schema, unused until now).

## Filter data — `src/lib/finvizFilters.js`

A static `FILTER_GROUPS` array — no fetching, no state — covering the ~20
categories from the spec, using Finviz's real documented screener filter
codes:

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

Each group's `options[0]` is always `{ value: '', label: 'Any' }` — an
empty value means "no filter for this category," omitted from the built
URL.

## URL builder — `src/lib/finvizUrl.js`

```js
export function buildFinvizUrl(filters) {
  const codes = Object.values(filters).filter((v) => v)
  if (codes.length === 0) return 'https://finviz.com/screener.ashx'
  return `https://finviz.com/screener.ashx?f=${codes.join(',')}`
}
```

Pure, fully unit-testable without any UI. `filters` is `{ [groupKey]:
filterCode }`; empty-string/undefined entries are dropped.

## Presets hook — `src/hooks/useScreenerSaves.js`

Mirrors `useAccounts`' load/insert shape:

```js
useScreenerSaves(accountId, userId) -> {
  saves: Array<{ id, name, filters, accountId }>,
  loading: boolean,
  savePreset(name, filters) -> Promise<void>,
  deletePreset(id) -> Promise<void>,
}
```

- `load()`: fetches `screener_saves` rows where `account_id = accountId`.
  Per the schema's documented behavior, when `accountId !== 'default'` it
  also fetches `account_id = 'default'` rows and merges them into the same
  list (shared/global presets visible to every account) — de-duplicated
  by `id`, own-account saves first.
- `savePreset(name, filters)`: inserts `{ account_id: accountId, user_id:
  userId, name, filters }`, reloads.
- `deletePreset(id)`: deletes by id, reloads. (No ownership check in the
  UI beyond what Supabase RLS already enforces at the database level —
  consistent with how `useAccounts`/`useInvestments` handle deletes
  elsewhere in this codebase.)

## Component — `src/components/analysis/ScreenerTab.jsx`

- Renders one `<select>` per `FILTER_GROUPS` entry, grid layout matching
  the `.fin-input-grid`/`.dcf-input-grid` visual pattern already
  established in Financials/DCF. Filter state: `const [filters, setFilters]
  = useState({})`.
- Below the grid: the live-built URL as **read-only text**, a **Copy URL**
  button (`navigator.clipboard.writeText`), and an **Open in Finviz ↗**
  link (`<a href={url} target="_blank" rel="noreferrer">`).
- **Saved Presets** section: a name `<input>` + **Save** button (saves the
  current `filters` state under that name via `savePreset`), then a list
  of saved presets, each row showing the name and two buttons — **Apply**
  (sets `filters` from `preset.filters`) and **Delete** (`deletePreset`).
- Props: `<ScreenerTab accountId={activeAccountId} userId={user?.id} />`.

## Page wiring

`AnalyzePage.jsx`: import `ScreenerTab`, render it for `tab === 'screener'`
(replaces the placeholder), passing `accountId={activeAccountId}
userId={user?.id}` (both already available in that component). With
Screener built, all 5 `TABS` entries (research/financials/dcf/risk/
screener) now render a real tab — the `AnalyzeTabPlaceholder` branch and
its "Coming soon" import/JSX stay in the file (harmless dead code path,
ready for the next tab that gets added later), but
`AnalyzePage.test.jsx`'s "shows a Coming soon placeholder" test is removed
since there's no remaining unbuilt tab left to click through to exercise
it.

## Out of scope

- Any live Finviz data fetching or in-app results rendering — this is a
  URL-builder/deep-link tool only, matching the original app.
- Editing/renaming an existing preset (only save-new and delete).

## Testing

- `finvizUrl.js`: `buildFinvizUrl` — empty filters → bare URL; single
  filter → `?f=code`; multiple filters → comma-joined; falsy/empty-string
  values filtered out.
- `useScreenerSaves.js`: load merges `default`-account saves when
  `accountId !== 'default'` and does not double-fetch when `accountId ===
  'default'`; `savePreset`/`deletePreset` call Supabase correctly and
  reload.
- `ScreenerTab.jsx`: renders a select per filter group; selecting values
  updates the displayed URL; Copy URL calls `navigator.clipboard.writeText`
  with the current URL; Open in Finviz link's `href` matches the built
  URL; saving a preset calls `savePreset` with current filters and the
  typed name; clicking Apply on a saved preset restores its filters into
  the selects; clicking Delete calls `deletePreset`.
- `AnalyzePage.jsx`: Screener tab renders `ScreenerTab` instead of the
  placeholder.
- Manual smoke test: build a filter combination, confirm the Finviz URL
  opens correctly with those filters pre-applied on finviz.com; save a
  preset, reload the page, confirm it's still listed and Apply restores
  it.

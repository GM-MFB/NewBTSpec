# Strategy Page — Design

## Context

The app records what was traded but says nothing about how to trade. This adds a `/strategy` page: a working reference for the options strategies actually used in this account, with calculators so it is something to open *before* placing a trade rather than a page read once.

Coverage, in priority order: **the Wheel** (the account's primary strategy, and the one that gets the deepest treatment), then **credit spreads**, **debit spreads**, **calendar spreads**, and **iron condors**.

Everything on the page is **at-expiration math**. The app has no live options pricing — that was ruled out during the Risk tab work and remains out of scope — so the calculators describe the shape of a trade, not its current mark.

## 1. Route and navigation

- New route `/strategy` in `src/App.jsx`, wrapped in the same auth guard as the other pages.
- New `NavLink` in `src/components/Header.jsx`, positioned between Analyze and Watchlist.
- `src/pages/StrategyPage.jsx` renders `Header` then a sub-tab bar, matching how `AnalyzePage` is built.
- Sub-tabs: **Wheel** (default) | **Credit Spreads** | **Debit Spreads** | **Calendars** | **Condors**.
- Active sub-tab is component state only. It is not persisted and not in the URL — consistent with `AnalyzePage`.

## 2. Content as data

All five strategies share one shape, so the content lives in `src/lib/strategyContent.js` as structured objects rendered by a single `StrategyArticle` component. Five near-identical hand-written layouts would drift apart; this keeps them uniform and makes a sixth strategy a data addition rather than a new component.

Each strategy object:

```js
{
  id: 'wheel',
  name: 'The Wheel',
  outlook: 'Neutral to bullish',
  capital: 'High — full collateral per contract',
  summary: '<one paragraph: what it is>',
  legs: ['<each leg of the position>'],
  keyFacts: [['Max profit', '…'], ['Max loss', '…'], ['Breakeven', '…'], ['Capital required', '…']],
  entry: ['<strike/delta selection>', '<DTE>', '<IV conditions>'],
  management: ['<profit target>', '<when to roll>', '<when to close>'],
  mistakes: ['<common mistake and why it costs>'],
  extraSections: [{ title: '…', body: [...] }],   // Wheel only
}
```

`StrategyArticle` renders, in order: summary → legs → key facts table → entry rules → management → common mistakes → any `extraSections` → the calculator.

**The Wheel's `extraSections`** cover what the other four do not need:

1. **The cycle** — sell cash-secured put → assigned → own 100 shares → sell covered call → called away → repeat.
2. **What assignment does to cost basis** — assigned at the strike, so cost basis is `strike − premium collected`, not the strike.
3. **When the stock craters** — the position that stops being a wheel and becomes a bag hold, and the choices at that point.
4. **Never sell a covered call below cost basis** — doing so locks in a loss if called away, which is the single most common way the wheel turns negative.

## 3. Calculators

Pure functions in `src/lib/strategyMath.js`. No React, no formatting — they return numbers (or `null`), and the components format them. One calculator per tab, rendered by `StrategyCalculator` switching on the strategy id.

### Cash-secured put (Wheel)

```
collateral       = strike × 100 × contracts
maxProfit        = premium × 100 × contracts
breakeven        = strike − premium
returnOnCapital  = maxProfit / collateral
annualized       = returnOnCapital × (365 / days)
```

### Covered call (Wheel)

```
profitIfCalled   = (premium + (strike − costBasis)) × 100 × contracts
breakeven        = costBasis − premium
returnIfCalled   = profitIfCalled / (costBasis × 100 × contracts)
```

`costBasis` is entered by the user; the article explains it is `assignment strike − premium collected`, not the strike.

**`profitIfCalled` is deliberately not clamped at zero.** When the call strike is below cost basis, being called away is a *loss* — sell a $95 call against a $100 cost basis for $2.00 and you net −$3.00 per share. Clamping to zero would display a positive figure and hide precisely the mistake the Wheel article warns about. It returns the real, negative number, and the UI shows it in red. The field is named `profitIfCalled` rather than `maxProfit` for the same reason: it is an outcome, not a ceiling.

### Credit spread

```
width       = |shortStrike − longStrike|
maxProfit   = credit × 100 × contracts
maxLoss     = (width − credit) × 100 × contracts
breakeven   = put spread:  shortStrike − credit
              call spread: shortStrike + credit
returnOnRisk = maxProfit / maxLoss
```

### Debit spread

```
width      = |longStrike − shortStrike|
maxProfit  = (width − debit) × 100 × contracts
maxLoss    = debit × 100 × contracts
breakeven  = call spread: longStrike + debit
             put spread:  longStrike − debit
```

### Calendar spread

```
maxLoss    = debit × 100 × contracts
maxProfit  = null      // deliberately
```

Max profit on a calendar is **not closed-form** — it depends on implied volatility at the near-term expiry and where the underlying sits relative to the strike. The calculator returns `null` and the UI states why rather than printing a number that would be invented. This is a requirement, not an omission.

### Iron condor

```
putWidth      = |shortPut − longPut|
callWidth     = |shortCall − longCall|
maxProfit     = credit × 100 × contracts
maxLoss       = (max(putWidth, callWidth) − credit) × 100 × contracts
lowerBreakeven = shortPut − credit
upperBreakeven = shortCall + credit
returnOnRisk   = maxProfit / maxLoss
```

Using the **wider** side for max loss is correct for a standard condor: only one side can finish in the money.

### Shared behaviour

- Every function returns `null` rather than `NaN`, `Infinity`, or a garbage number when inputs are missing, zero, or nonsensical (zero-width spread, credit exceeding width, zero days).
- Annualization reuses the convention established in `src/lib/annualizedReturn.js`: simple scaling `× (365 / days)`, elapsed days, floored at 1. A figure computed here must match what the same trade shows once closed.

## 4. Files

| File | Responsibility |
|---|---|
| `src/pages/StrategyPage.jsx` | Route shell, header, sub-tab state |
| `src/pages/StrategyPage.css` | Page and article styling |
| `src/lib/strategyContent.js` | The five strategy content objects |
| `src/lib/strategyMath.js` | All calculator math, pure |
| `src/components/strategy/StrategyArticle.jsx` | Renders one strategy's content |
| `src/components/strategy/StrategyCalculator.jsx` | Renders the calculator for a strategy id |
| `src/App.jsx` | Add the route (modify) |
| `src/components/Header.jsx` | Add the nav link (modify) |

## 5. Testing

**`strategyMath.js` — full unit coverage.** Every function tested with worked examples using realistic numbers:

- CSP: 380 strike, $2.00 premium, 30 days → $38,000 collateral, $200 max profit, $378 breakeven, 0.526% on capital, 6.4% annualized.
- Credit spread: 36/35 put spread for $0.40 → $40 max profit, $60 max loss, $35.60 breakeven, 66.7% return on risk.
- Debit spread: 100/105 call spread for $2.00 → $300 max profit, $200 max loss, $102 breakeven.
- Condor: 95/90 put and 105/110 call for $1.20 → $120 max profit, $380 max loss, breakevens $93.80 and $106.20.
- Calendar: max profit is `null`; max loss is the debit.
- Covered call sold **below** cost basis returns a negative `profitIfCalled` — a $95 call on a $100 basis for $2.00 gives −$300, not $200. This is the test that stops the clamping bug from being reintroduced.
- Null/guard cases for each: missing inputs, zero contracts, zero-width spread, credit ≥ width, zero days.

**Page tests** (`StrategyPage.test.jsx`): Wheel tab is active on load; clicking a sub-tab swaps the content; each of the five renders its required sections (summary, key facts, entry, management, mistakes); the calendar tab states that max profit is not calculable; a calculator recomputes when an input changes.

**Content is not asserted line by line.** Tests assert that each strategy renders its required *sections*, so a missing block fails loudly, but the prose itself is free to be edited without breaking tests.

## Out of scope

- Live options pricing, greeks, implied volatility data — no source exists in the app and it was explicitly ruled out during the Risk tab work.
- Payoff diagrams/charts. The key-facts table and calculators carry the same information; charts can follow later if wanted.
- Tying the page to open positions in the account. Considered and deliberately deferred — the page is a reference, and a thin data connection would add complexity without much value.
- Persisting sub-tab selection or putting it in the URL.
- Strategies beyond the five named: no straddles, strangles, ratios, butterflies, LEAPS, or naked calls.

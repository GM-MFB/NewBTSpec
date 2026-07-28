# Risk Tab Overhaul — Design

## Context

`RiskTab.jsx` (wired into `AnalyzePage.jsx` as `analyze → Risk`) currently derives its position list from `investments.filter(i => ['Stock','ETF','Crypto'].includes(i.assetType))`, which silently excludes every open option position. For a user who trades options regularly, this means the Risk tab's beta, VaR, HHI, diversification score, and stress tests describe only part of the portfolio — sometimes a small part. The user asked for a more detailed overhaul, and specifically confirmed:

- Options should be included in risk analysis.
- Options should be sized by **collateral / max-loss**, not by a priced Black-Scholes/greeks model (explicitly rejected — no options pricing model exists anywhere in this codebase, and adding one is out of scope).

`src/lib/portfolioWeights.js` already solves the "value an option position" problem for the Frontier panel (`computePositionWeights`, `computePositionTotalValue`, built earlier this session), using `collateralFor()` from `src/lib/optionMath.js` and `effectiveStrategyDef()` from `src/lib/optionStrategies.js`. This design reuses that same valuation approach for consistency across the app, and extends it with a max-loss figure for long options (which `collateralFor` deliberately returns `''` for, since long options tie up no cash collateral).

## 1. Data & position model

Replace `RiskTab.jsx`'s inline `investments.filter(...)` with a broadened position list that includes `'Option'` alongside `'Stock'`, `'ETF'`, `'Crypto'`. Each position gets:

- `symbol`, `assetType` (new field — needed downstream to scope stop-loss logic to non-option types).
- `marketValue`: for Stock/ETF/Crypto, `shares * currentPrice` (unchanged). For Option, the same valuation used by `computePositionWeights`: `collateralFor(position, effectiveStrategyDef(position))` for short (non-covered-call) positions, and a new **capital-at-risk** figure for long positions and covered calls (see Section 2 — `optionsCapitalAtRisk()`), since a long option's risk is its premium paid, not a collateral figure.
- `currentPrice`, `shares`, `stopLoss`: unchanged, only meaningful for Stock/ETF/Crypto; left `undefined`/`null` for Option positions (never read for options — see stop-loss scoping below).

Multiple positions sharing a symbol (e.g., SPY stock + a SPY put) already collapse correctly today via a `reduce`; this continues to work since each position contributes its own `marketValue` to the same running totals — beta/correlation lookups are symbol-keyed so a stock and an option on the same underlying correctly share one `getAssetParams`/`getCorrelation` profile.

Bonds remain unhandled/$0-weighted — unchanged, no bond risk data exists anywhere in the codebase, and it's out of scope here.

**Stop-loss scoping fix:** today's `getPortfolioRiskMetrics` computes `stopCoveragePct` as `positions.filter(p => p.stopLoss).length / positions.length`. Once `positions` includes options (which never have a `stopLoss`), that denominator would grow and permanently dilute the coverage percentage even though options have their own bounded-risk model (Section 2) — not a coverage gap. Fix: `getPortfolioRiskMetrics` filters the stop-coverage/dollar-at-risk calculation to `positions.filter(p => p.assetType !== 'Option')` internally, while HHI/beta/volatility/totalMV continue to use the full combined list. The existing `dollarAtRisk` reduce is already safe for option rows (it short-circuits on `!p.stopLoss` before touching `currentPrice`/`shares`), so only the coverage percentage's denominator needs the explicit filter.

## 2. New "Options Risk" section

A new section, rendered between "Stop Loss Protection" and "Stress Tests", listing every open option position:

| Symbol | Strategy | Contracts | Capital at Risk | % of Portfolio |

- **Strategy**: `effectiveStrategyDef(position).label` (e.g. "Cash Secured Put", "Put Credit Spread", "Long Call").
- **Contracts**: `position.shares` (the schema's field name for option contract count).
- **Capital at Risk** — a new `optionsCapitalAtRisk(position, strategyDef)` helper in `src/lib/optionMath.js`:
  - Short, non-covered-call (CSP, credit spreads): `collateralFor(position, strategyDef)`.
  - Covered call: `0` (rendered as "Covered" in the table, not `$0`).
  - Long call/put: premium paid, `Number(position.avgCost) * 100 * Number(position.shares)` (mirrors the existing `potentialPnlFor` formula, just applied to long instead of short).
- **% of Portfolio**: `capitalAtRisk / totalPortfolioValue * 100`, where `totalPortfolioValue` is `metrics.totalMV` from `getPortfolioRiskMetrics` (Section 1's combined stock + ETF + crypto + option total) — reused rather than recomputed, so the percentage always agrees with the hero tiles.

`getRiskContribution(positions)` is called with the same full combined list from Section 1 (it's purely symbol/weight-driven, no stop-loss or marketValue fields involved), so the existing "Risk Contribution" table picks up option symbols automatically with no changes to that function.

Below the table: a **"Total Options Capital at Risk"** line summing the column, plus its % of total portfolio value. If there are no open option positions, the section renders a brief "No open option positions" note instead of an empty table (consistent with how other tabs handle empty states).

## 3. Stress Tests extended to options

No options pricing model exists and the user explicitly ruled one out, so options get a **binary bounded rule** layered onto the existing 6-scenario stress table rather than a beta-scaled estimate:

- Each option position has an **adverse direction** — the single scenario direction that would hurt it — derived from `optionType` + `optionDirection` (already on `effectiveStrategyDef`'s output):
  - `call` + `long` → hurt by a **down** move (calls lose value when the underlying drops).
  - `put` + `long` → hurt by an **up** move.
  - `put` + `short` (CSP, put credit spread) → hurt by a **down** move (assignment risk).
  - `call` + `short` (call credit spread; covered call excluded, see below) → hurt by an **up** move.
- In a scenario matching the adverse direction, impact = `-capitalAtRisk` (full loss, from Section 2's helper). In the other direction, impact = `$0` — no attempt is made to estimate favorable-direction gains, since that would require pricing the option.
- Covered calls always show `$0` impact in every scenario, since their `capitalAtRisk` is `0`.
- These option rows are merged into the same per-scenario table as the existing stock/ETF/crypto rows (one combined table per scenario, sorted ascending by `$ Impact` as today), with `Beta` and `Move %` shown as `—` for option rows since those columns don't apply to a bounded estimate.
- The scenario header's dollar total changes from `portfolioMove * totalMV` (a beta-weighted % times a dollar base) to the literal sum of that scenario's `perPosition` impacts. This keeps the header number always equal to the visible table's total by construction, whether or not options are present, and avoids mixing a stock-only beta-weighted % against a totalMV that now includes options. The `portfolioMove` percentage itself is unchanged (still the stock/ETF/crypto beta-weighted move) and continues to display next to the dollar figure as today.
- The whole section keeps (and slightly expands) its existing framing copy that this is a simplified estimate, not a priced options model.

`getStressTests(positions, optionPositions = [])` gains a second parameter for the option position list; the first `positions` argument stays exactly as it is today (stock/ETF/crypto only, beta-weighted), so the existing $-total-per-symbol math for non-option rows is untouched. At the call site, `RiskTab.jsx` passes its Section 1 combined list filtered to `p.assetType !== 'Option'` as the first argument, and the option positions (with their `capitalAtRisk` and `optionType`/`optionDirection` already attached) as the second.

## 4. Updates to existing sections

- **Concentration Risk / hero tiles** (Portfolio Beta, 1-Day 95% VaR, Diversification Score): now computed from the Section 1 combined weight set, so a large option position can affect "largest position," HHI, beta, and volatility — previously these were entirely invisible to options.
- **Stop Loss Protection**: stays scoped to Stock/ETF/Crypto only (`stopLoss` is a stock-oriented field in this schema), using the Section 1 filter fix. A new one-line caption is added: "Options have a defined max loss instead of a stop — see Options Risk below," so the scoping reads as intentional rather than a gap.

## 5. Testing

- `src/lib/optionMath.test.js`: new tests for `optionsCapitalAtRisk()` covering short CSP, both credit spread directions, covered call ($0), long call, long put.
- `src/lib/efficientFrontier.test.js`: 
  - `getPortfolioRiskMetrics` — a test asserting an included option position affects `hhi`/`beta`/`totalMV`, and a test asserting `stopCoveragePct` is computed only over non-option positions (denominator excludes options) even when options are present.
  - `getStressTests` — tests for the binary bounded rule in both directions (long call hurt by down-move scenarios, $0 in Bull Run; long put hurt by Bull Run, $0 in down-move scenarios; CSP/put-credit-spread hurt by down-move; call-credit-spread hurt by Bull Run; covered call always $0), and a test that the scenario header dollar total equals the sum of that scenario's `perPosition` impacts.
- `src/components/analysis/RiskTab.test.jsx`: the existing 4 tests (hero tiles present, <80% coverage warning copy, 6 expandable stress scenarios, Risk Contribution rows) use Stock/ETF-only fixtures and must continue passing unchanged as a non-regression check. New tests added: Options Risk section renders a row per open option position with the correct Capital at Risk figure, the "Total Options Capital at Risk" summary line, the empty-state note when there are no option positions, and the Stop Loss caption text.

## Out of scope

- Bond risk data/modeling.
- Any options pricing model (Black-Scholes, greeks, implied vol).
- Changing how Stop Loss Protection is scoped (stays Stock/ETF/Crypto).

// At-expiration math for the strategies on the Strategy page. No live options
// pricing exists in this app, so these describe the shape of a trade — what it
// can make, what it can lose, where it breaks even — not what it is worth now.
//
// Every function returns nulls rather than NaN or Infinity when the inputs do
// not describe a real position, so the UI never prints a garbage number.

const SHARES_PER_CONTRACT = 100

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function nulls(keys) {
  return Object.fromEntries(keys.map((k) => [k, null]))
}

export function cashSecuredPut({ strike, premium, contracts, days } = {}) {
  const keys = ['collateral', 'maxProfit', 'breakeven', 'returnOnCapital', 'annualized']
  const s = num(strike)
  const p = num(premium)
  const n = num(contracts)
  if (s <= 0 || p <= 0 || n <= 0) return nulls(keys)

  const collateral = s * SHARES_PER_CONTRACT * n
  const maxProfit = p * SHARES_PER_CONTRACT * n
  const returnOnCapital = maxProfit / collateral
  // Matches annualizedReturn.js: simple scaling, elapsed days, floored at 1.
  const heldDays = Math.max(num(days), 1)

  return {
    collateral,
    maxProfit,
    breakeven: s - p,
    returnOnCapital,
    annualized: returnOnCapital * (365 / heldDays),
  }
}

export function coveredCall({ strike, premium, costBasis, contracts } = {}) {
  const keys = ['profitIfCalled', 'breakeven', 'returnIfCalled']
  const s = num(strike)
  const p = num(premium)
  const basis = num(costBasis)
  const n = num(contracts)
  if (s <= 0 || p <= 0 || basis <= 0 || n <= 0) return nulls(keys)

  // Deliberately unclamped. Selling a call below cost basis means being called
  // away at a loss; showing zero here would hide the most common way the wheel
  // turns negative.
  const profitIfCalled = (p + (s - basis)) * SHARES_PER_CONTRACT * n
  const sharesCost = basis * SHARES_PER_CONTRACT * n

  return {
    profitIfCalled,
    breakeven: basis - p,
    returnIfCalled: profitIfCalled / sharesCost,
  }
}

export function creditSpread({ shortStrike, longStrike, credit, contracts, type = 'put' } = {}) {
  const keys = ['width', 'maxProfit', 'maxLoss', 'breakeven', 'returnOnRisk']
  const short = num(shortStrike)
  const long = num(longStrike)
  const c = num(credit)
  const n = num(contracts)
  const width = Math.abs(short - long)
  // A credit at or above the width is not a fill that exists — it would be
  // risk-free money.
  if (short <= 0 || long <= 0 || c <= 0 || n <= 0 || width <= 0 || c >= width) return nulls(keys)

  const maxProfit = c * SHARES_PER_CONTRACT * n
  const maxLoss = (width - c) * SHARES_PER_CONTRACT * n

  return {
    width,
    maxProfit,
    maxLoss,
    breakeven: type === 'call' ? short + c : short - c,
    returnOnRisk: maxProfit / maxLoss,
  }
}

export function debitSpread({ longStrike, shortStrike, debit, contracts, type = 'call' } = {}) {
  const keys = ['width', 'maxProfit', 'maxLoss', 'breakeven']
  const long = num(longStrike)
  const short = num(shortStrike)
  const d = num(debit)
  const n = num(contracts)
  const width = Math.abs(long - short)
  // Paying the full width leaves nothing to gain.
  if (long <= 0 || short <= 0 || d <= 0 || n <= 0 || width <= 0 || d >= width) return nulls(keys)

  return {
    width,
    maxProfit: (width - d) * SHARES_PER_CONTRACT * n,
    maxLoss: d * SHARES_PER_CONTRACT * n,
    breakeven: type === 'put' ? long - d : long + d,
  }
}

export function calendarSpread({ debit, contracts } = {}) {
  const d = num(debit)
  const n = num(contracts)
  if (d <= 0 || n <= 0) return { maxLoss: null, maxProfit: null }

  return {
    maxLoss: d * SHARES_PER_CONTRACT * n,
    // Not an omission. Max profit on a calendar depends on implied volatility
    // at the near-term expiry and where the underlying sits relative to the
    // strike — there is no closed form, and inventing one would mislead.
    maxProfit: null,
  }
}

export function ironCondor({ shortPut, longPut, shortCall, longCall, credit, contracts } = {}) {
  const keys = ['maxProfit', 'maxLoss', 'lowerBreakeven', 'upperBreakeven', 'returnOnRisk']
  const sp = num(shortPut)
  const lp = num(longPut)
  const sc = num(shortCall)
  const lc = num(longCall)
  const c = num(credit)
  const n = num(contracts)

  const putWidth = Math.abs(sp - lp)
  const callWidth = Math.abs(sc - lc)
  // Only one side can finish in the money, so the wider side sets the risk.
  const width = Math.max(putWidth, callWidth)
  if (sp <= 0 || lp <= 0 || sc <= 0 || lc <= 0 || c <= 0 || n <= 0 || width <= 0 || c >= width) {
    return nulls(keys)
  }

  const maxProfit = c * SHARES_PER_CONTRACT * n
  const maxLoss = (width - c) * SHARES_PER_CONTRACT * n

  return {
    maxProfit,
    maxLoss,
    lowerBreakeven: sp - c,
    upperBreakeven: sc + c,
    returnOnRisk: maxProfit / maxLoss,
  }
}

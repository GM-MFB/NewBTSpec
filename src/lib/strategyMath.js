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

// ---------------------------------------------------------------------------
// Added strategies
// ---------------------------------------------------------------------------

// A long call's upside is unbounded, so maxProfit is null rather than a number.
// A long put's is bounded only by the underlying reaching zero.
export function longOption({ strike, premium, contracts, type = 'call' } = {}) {
  const keys = ['maxLoss', 'maxProfit', 'breakeven']
  const s = num(strike)
  const p = num(premium)
  const n = num(contracts)
  if (s <= 0 || p <= 0 || n <= 0) return nulls(keys)

  return {
    maxLoss: p * SHARES_PER_CONTRACT * n,
    maxProfit: type === 'put' ? (s - p) * SHARES_PER_CONTRACT * n : null,
    breakeven: type === 'put' ? s - p : s + p,
  }
}

// Poor man's covered call: a long dated call standing in for 100 shares, with a
// near-dated call sold against it. The ceiling assumes both legs run to the long
// leg's expiry — before then the long call still holds time value, so the real
// outcome differs.
export function poorMansCoveredCall({ longStrike, longDebit, shortStrike, shortCredit, contracts } = {}) {
  const keys = ['netDebit', 'maxLoss', 'profitCeiling', 'breakeven']
  const ls = num(longStrike)
  const ld = num(longDebit)
  const ss = num(shortStrike)
  const sc = num(shortCredit)
  const n = num(contracts)
  const width = ss - ls
  // Selling a call below the long strike caps the position under water.
  if (ls <= 0 || ld <= 0 || ss <= 0 || n <= 0 || width <= 0) return nulls(keys)

  const net = ld - sc
  if (net <= 0) return nulls(keys)

  return {
    netDebit: net * SHARES_PER_CONTRACT * n,
    maxLoss: net * SHARES_PER_CONTRACT * n,
    profitCeiling: (width - net) * SHARES_PER_CONTRACT * n,
    breakeven: ls + net,
  }
}

export function protectivePut({ costBasis, putStrike, putPremium, contracts } = {}) {
  const keys = ['maxLoss', 'breakeven', 'insuranceCost', 'maxProfit']
  const basis = num(costBasis)
  const strike = num(putStrike)
  const premium = num(putPremium)
  const n = num(contracts)
  if (basis <= 0 || strike <= 0 || premium <= 0 || n <= 0) return nulls(keys)

  return {
    // The floor: shares can only fall to the put strike, plus what the put cost.
    maxLoss: (basis - strike + premium) * SHARES_PER_CONTRACT * n,
    breakeven: basis + premium,
    insuranceCost: premium * SHARES_PER_CONTRACT * n,
    // Upside is untouched by the put, so there is no ceiling.
    maxProfit: null,
  }
}

export function collar({ costBasis, putStrike, putPremium, callStrike, callCredit, contracts } = {}) {
  const keys = ['netCost', 'maxLoss', 'maxProfit', 'breakeven']
  const basis = num(costBasis)
  const ps = num(putStrike)
  const pp = num(putPremium)
  const cs = num(callStrike)
  const cc = num(callCredit)
  const n = num(contracts)
  if (basis <= 0 || ps <= 0 || cs <= 0 || n <= 0 || cs <= ps) return nulls(keys)

  // Negative when the call pays for more than the put — a credit collar.
  const net = pp - cc

  return {
    netCost: net * SHARES_PER_CONTRACT * n,
    maxLoss: (basis - ps + net) * SHARES_PER_CONTRACT * n,
    maxProfit: (cs - basis - net) * SHARES_PER_CONTRACT * n,
    breakeven: basis + net,
  }
}

// Equal strikes make it a straddle; different strikes a strangle. Short loses
// without bound, so maxLoss is null rather than a figure.
export function strangle({ putStrike, callStrike, premium, contracts, direction = 'short' } = {}) {
  const keys = ['maxProfit', 'maxLoss', 'lowerBreakeven', 'upperBreakeven']
  const ps = num(putStrike)
  const cs = num(callStrike)
  const p = num(premium)
  const n = num(contracts)
  if (ps <= 0 || cs <= 0 || p <= 0 || n <= 0 || cs < ps) return nulls(keys)

  const total = p * SHARES_PER_CONTRACT * n
  const short = direction === 'short'

  return {
    maxProfit: short ? total : null,
    maxLoss: short ? null : total,
    lowerBreakeven: ps - p,
    upperBreakeven: cs + p,
  }
}

export function ironButterfly({ centerStrike, wingWidth, credit, contracts } = {}) {
  const keys = ['maxProfit', 'maxLoss', 'lowerBreakeven', 'upperBreakeven', 'returnOnRisk']
  const center = num(centerStrike)
  const width = num(wingWidth)
  const c = num(credit)
  const n = num(contracts)
  if (center <= 0 || width <= 0 || c <= 0 || n <= 0 || c >= width) return nulls(keys)

  const maxProfit = c * SHARES_PER_CONTRACT * n
  const maxLoss = (width - c) * SHARES_PER_CONTRACT * n

  return {
    maxProfit,
    maxLoss,
    lowerBreakeven: center - c,
    upperBreakeven: center + c,
    returnOnRisk: maxProfit / maxLoss,
  }
}

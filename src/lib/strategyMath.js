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

// ---------------------------------------------------------------------------
// Premium-seller structures
// ---------------------------------------------------------------------------

// Short put plus a short call spread. Size the credit above the call spread's
// width and the upside risk disappears entirely — that is the whole point of
// the structure, so it is reported explicitly.
export function jadeLizard({ putStrike, shortCall, longCall, credit, contracts } = {}) {
  const keys = ['maxProfit', 'callWidth', 'upsideRisk', 'downsideBreakeven', 'maxDownsideLoss', 'upsideCovered']
  const ps = num(putStrike)
  const sc = num(shortCall)
  const lc = num(longCall)
  const c = num(credit)
  const n = num(contracts)
  const callWidth = lc - sc
  if (ps <= 0 || sc <= 0 || lc <= 0 || c <= 0 || n <= 0 || callWidth <= 0) return nulls(keys)

  const upside = Math.max(0, callWidth - c)

  return {
    maxProfit: c * SHARES_PER_CONTRACT * n,
    callWidth,
    upsideRisk: upside * SHARES_PER_CONTRACT * n,
    upsideCovered: c >= callWidth,
    downsideBreakeven: ps - c,
    // The put side behaves like a cash-secured put: the floor is the stock at zero.
    maxDownsideLoss: (ps - c) * SHARES_PER_CONTRACT * n,
  }
}

// Own the shares, sell a put and a call against them. Double premium, and a
// second assignment waiting if the stock falls.
export function coveredStrangle({ costBasis, putStrike, callStrike, credit, contracts } = {}) {
  const keys = ['maxProfit', 'breakeven', 'sharesIfAssigned', 'blendedBasis', 'capitalRequired']
  const basis = num(costBasis)
  const ps = num(putStrike)
  const cs = num(callStrike)
  const c = num(credit)
  const n = num(contracts)
  if (basis <= 0 || ps <= 0 || cs <= 0 || c <= 0 || n <= 0) return nulls(keys)

  return {
    // Called away at the call strike, having collected both premiums.
    maxProfit: ((cs - basis) + c) * SHARES_PER_CONTRACT * n,
    breakeven: basis - c,
    // Assignment doubles the position, so the basis is the average of the two.
    sharesIfAssigned: 200 * n,
    blendedBasis: (basis + ps - c) / 2,
    capitalRequired: ps * SHARES_PER_CONTRACT * n,
  }
}

// Uneven wings: the narrow side is the profit tent, the wide side carries the
// risk. Taken for a credit, the narrow side finishes risk-free.
export function brokenWingButterfly({ shortStrike, narrowWing, wideWing, credit, contracts } = {}) {
  const keys = ['maxProfit', 'maxLoss', 'peakStrike', 'riskFreeSide', 'breakeven']
  const short = num(shortStrike)
  const narrow = num(narrowWing)
  const wide = num(wideWing)
  const c = num(credit)
  const n = num(contracts)
  if (short <= 0 || narrow <= 0 || wide <= 0 || n <= 0 || wide <= narrow) return nulls(keys)

  const maxLossPerShare = wide - narrow - c
  return {
    maxProfit: (narrow + c) * SHARES_PER_CONTRACT * n,
    maxLoss: Math.max(0, maxLossPerShare) * SHARES_PER_CONTRACT * n,
    peakStrike: short,
    // A credit means nothing is lost if it expires past the narrow wing.
    riskFreeSide: c > 0,
    breakeven: short - narrow - c,
  }
}

// ---------------------------------------------------------------------------
// Portfolio approaches
// ---------------------------------------------------------------------------

// Systematic far-OTM put buying. The question is never "what does one put do"
// but "what does the programme cost per year, and what does it pay in a crash".
export function tailHedge({ portfolioValue, spotPrice, strikePct, premium, contracts, rollsPerYear } = {}) {
  const keys = ['strike', 'annualCost', 'costAsPct', 'payoffs']
  const pv = num(portfolioValue)
  const spot = num(spotPrice)
  const pct = num(strikePct)
  const p = num(premium)
  const n = num(contracts)
  const rolls = num(rollsPerYear)
  if (pv <= 0 || spot <= 0 || pct <= 0 || pct >= 100 || p <= 0 || n <= 0 || rolls <= 0) return nulls(keys)

  const strike = spot * (1 - pct / 100)
  const annualCost = p * SHARES_PER_CONTRACT * n * rolls

  // What the hedge pays against what the portfolio loses, at each drawdown.
  const payoffs = [10, 20, 30, 40, 50].map((drop) => {
    const endPrice = spot * (1 - drop / 100)
    const hedgePayoff = Math.max(0, strike - endPrice) * SHARES_PER_CONTRACT * n
    const portfolioLoss = pv * (drop / 100)
    return {
      drop,
      hedgePayoff,
      portfolioLoss,
      netLoss: portfolioLoss - hedgePayoff,
      coverage: portfolioLoss > 0 ? hedgePayoff / portfolioLoss : 0,
    }
  })

  return { strike, annualCost, costAsPct: annualCost / pv, payoffs }
}

// A buffer: long stock exposure, downside absorbed to a point, upside capped.
// Structurally a collar, which is why it belongs beside one.
export function bufferStructure({ portfolioValue, bufferPct, capPct } = {}) {
  const keys = ['bufferedTo', 'cappedAt', 'outcomes']
  const pv = num(portfolioValue)
  const buffer = num(bufferPct)
  const cap = num(capPct)
  if (pv <= 0 || buffer <= 0 || cap <= 0) return nulls(keys)

  const outcomes = [-30, -20, -10, 0, 10, 20, 30].map((move) => {
    let result
    if (move >= 0) result = Math.min(move, cap)
    // The buffer absorbs the first slice of a fall; beyond it losses resume.
    else result = Math.min(0, move + buffer)
    return { move, result, value: pv * (1 + result / 100) }
  })

  return { bufferedTo: buffer, cappedAt: cap, outcomes }
}

// Short put funded by a long call. Behaves like the shares above and below the
// strikes, with a flat stretch between them where only the credit remains.
export function riskReversal({ putStrike, callStrike, netCredit, contracts } = {}) {
  const keys = ['maxProfit', 'maxLoss', 'lowerBreakeven', 'flatZone', 'creditKept']
  const ps = num(putStrike)
  const cs = num(callStrike)
  const c = num(netCredit)
  const n = num(contracts)
  if (ps <= 0 || cs <= 0 || n <= 0 || cs <= ps) return nulls(keys)

  return {
    // Unbounded above the call strike, exactly as owning the shares would be.
    maxProfit: null,
    maxLoss: (ps - c) * SHARES_PER_CONTRACT * n,
    lowerBreakeven: ps - c,
    flatZone: [ps, cs],
    creditKept: c * SHARES_PER_CONTRACT * n,
  }
}

// One leg against two. A front ratio is long 1 near / short 2 far — a credit
// with an unbounded tail past the far strike. A backspread reverses it: short 1
// near / long 2 far, often for a credit, paying without limit on a big move.
//
// `near` is the single leg, `far` the doubled one. For calls far sits above
// near; for puts, below.
export function ratioSpread({ nearStrike, farStrike, credit, contracts, type = 'call', structure = 'front' } = {}) {
  const keys = ['width', 'peak', 'maxProfit', 'maxLoss', 'tailBreakeven', 'peakStrike']
  const near = num(nearStrike)
  const far = num(farStrike)
  const c = num(credit)
  const n = num(contracts)
  const width = Math.abs(far - near)
  if (near <= 0 || far <= 0 || n <= 0 || width <= 0) return nulls(keys)
  // Calls ratio upward, puts downward. Anything else is not the structure.
  if (type === 'call' && far <= near) return nulls(keys)
  if (type === 'put' && far >= near) return nulls(keys)

  const front = structure === 'front'
  const peak = (width + c) * SHARES_PER_CONTRACT * n
  const trough = (c - width) * SHARES_PER_CONTRACT * n
  // Past the far strike the extra short (front) or extra long (back) leg runs
  // one for one with the underlying, in one direction, without limit.
  const tail = type === 'call' ? far + width + c : far - width - c

  return {
    width,
    peakStrike: far,
    peak: front ? peak : trough,
    maxProfit: front ? peak : null,
    maxLoss: front ? null : Math.max(0, -trough) * 1,
    tailBreakeven: front ? tail : (type === 'call' ? far + width - c : far - width + c),
  }
}

// How much index exposure offsets a portfolio's market risk. Beta scales the
// notional: a book that moves 1.2x the index needs 1.2x its own value hedged to
// be neutral, not 1.0x.
export function betaHedge({ portfolioValue, portfolioBeta, indexPrice, hedgeRatio } = {}) {
  const keys = ['hedgedNotional', 'contracts', 'outcomes']
  const pv = num(portfolioValue)
  const beta = num(portfolioBeta)
  const index = num(indexPrice)
  const ratio = num(hedgeRatio)
  if (pv <= 0 || beta <= 0 || index <= 0 || ratio <= 0) return nulls(keys)

  const hedgedNotional = pv * beta * (ratio / 100)
  const contracts = hedgedNotional / (index * SHARES_PER_CONTRACT)

  const outcomes = [-30, -20, -10, 0, 10, 20].map((move) => {
    const fraction = move / 100
    const portfolioChange = pv * beta * fraction
    // Short exposure: gains when the market falls, gives back when it rises.
    const hedgeChange = -hedgedNotional * fraction
    return {
      move,
      portfolioChange,
      hedgeChange,
      net: portfolioChange + hedgeChange,
    }
  })

  return { hedgedNotional, contracts, outcomes }
}

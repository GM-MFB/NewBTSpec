// Profit and loss at expiration across a range of underlying prices — the
// payoff diagram behind each calculator. Pure functions: no React, no
// formatting, no colour.
//
// Calendar spreads are deliberately absent. Their value at the near-term expiry
// depends on implied volatility and the remaining life of the far leg, so there
// is no expiration payoff to plot, for the same reason there is no max profit.

const SHARES_PER_CONTRACT = 100
const SAMPLE_COUNT = 80

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const intrinsicCall = (price, strike) => Math.max(0, price - strike)
const intrinsicPut = (price, strike) => Math.max(0, strike - price)

const PAYOFFS = {
  'wheel-put': ({ strike, premium, contracts }, price) =>
    (num(premium) - intrinsicPut(price, num(strike))) * SHARES_PER_CONTRACT * num(contracts),

  'wheel-call': ({ strike, premium, costBasis, contracts }, price) =>
    ((price - num(costBasis)) + num(premium) - intrinsicCall(price, num(strike)))
    * SHARES_PER_CONTRACT * num(contracts),

  'credit-spread': ({ shortStrike, longStrike, credit, contracts, type }, price) => {
    const short = num(shortStrike)
    const long = num(longStrike)
    const spent = type === 'call'
      ? intrinsicCall(price, short) - intrinsicCall(price, long)
      : intrinsicPut(price, short) - intrinsicPut(price, long)
    return (num(credit) - spent) * SHARES_PER_CONTRACT * num(contracts)
  },

  'debit-spread': ({ longStrike, shortStrike, debit, contracts, type }, price) => {
    const long = num(longStrike)
    const short = num(shortStrike)
    const gained = type === 'put'
      ? intrinsicPut(price, long) - intrinsicPut(price, short)
      : intrinsicCall(price, long) - intrinsicCall(price, short)
    return (gained - num(debit)) * SHARES_PER_CONTRACT * num(contracts)
  },

  'iron-condor': ({ shortPut, longPut, shortCall, longCall, credit, contracts }, price) => {
    const putSide = intrinsicPut(price, num(shortPut)) - intrinsicPut(price, num(longPut))
    const callSide = intrinsicCall(price, num(shortCall)) - intrinsicCall(price, num(longCall))
    return (num(credit) - putSide - callSide) * SHARES_PER_CONTRACT * num(contracts)
  },
}

export function payoffAt(kind, params, price) {
  const fn = PAYOFFS[kind]
  return fn ? fn(params, price) : null
}

// The strike prices are where the payoff bends. Sampling uniformly would round
// those corners off, so they are added explicitly.
function strikesFor(kind, params) {
  switch (kind) {
    case 'wheel-put': return [num(params.strike)]
    case 'wheel-call': return [num(params.strike), num(params.costBasis)]
    case 'credit-spread': return [num(params.shortStrike), num(params.longStrike)]
    case 'debit-spread': return [num(params.longStrike), num(params.shortStrike)]
    case 'iron-condor': return [num(params.shortPut), num(params.longPut), num(params.shortCall), num(params.longCall)]
    default: return []
  }
}

function isValid(kind, params, strikes) {
  if (!PAYOFFS[kind]) return false
  if (num(params.contracts) <= 0) return false
  if (strikes.some((s) => s <= 0)) return false

  if (kind === 'credit-spread' || kind === 'debit-spread') {
    const [a, b] = strikes
    if (Math.abs(a - b) <= 0) return false
  }
  if (kind === 'iron-condor') {
    const [sp, lp, sc, lc] = strikes
    if (Math.abs(sp - lp) <= 0 || Math.abs(sc - lc) <= 0) return false
  }
  return true
}

// Zero crossings, found by scanning the sampled curve and interpolating. Works
// for every strategy here without each needing its own breakeven formula.
function findBreakevens(points) {
  const crossings = []
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    if (prev.pnl === 0) crossings.push(prev.price)
    else if ((prev.pnl < 0) !== (curr.pnl < 0)) {
      const span = curr.pnl - prev.pnl
      const ratio = span === 0 ? 0 : -prev.pnl / span
      crossings.push(prev.price + ratio * (curr.price - prev.price))
    }
  }
  return crossings.map((c) => Math.round(c * 1e6) / 1e6)
}

export function payoffCurve(kind, params = {}) {
  const strikes = strikesFor(kind, params)
  if (!isValid(kind, params, strikes)) return null

  const low = Math.min(...strikes)
  const high = Math.max(...strikes)
  // Pad outward so the flat regions beyond the outermost strikes are visible;
  // a spread whose strikes are close together still needs a readable window.
  const pad = Math.max((high - low) * 1.5, high * 0.12)
  const from = Math.max(0, low - pad)
  const to = high + pad

  const step = (to - from) / SAMPLE_COUNT
  const prices = new Set()
  for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
    prices.add(Math.round((from + i * step) * 1e6) / 1e6)
  }
  for (const strike of strikes) prices.add(strike)

  const points = [...prices]
    .sort((a, b) => a - b)
    .map((price) => ({ price, pnl: payoffAt(kind, params, price) }))

  return { points, breakevens: findBreakevens(points), from, to }
}

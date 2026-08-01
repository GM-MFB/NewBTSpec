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

  'long-option': ({ strike, premium, contracts, type }, price) => {
    const intrinsic = type === 'put' ? intrinsicPut(price, num(strike)) : intrinsicCall(price, num(strike))
    return (intrinsic - num(premium)) * SHARES_PER_CONTRACT * num(contracts)
  },

  // At the long leg's expiry the diagonal has collapsed into a call spread, so
  // this is the payoff if both legs are carried that far — not the near-term
  // outcome, which still contains the long call's remaining time value.
  'pmcc': ({ longStrike, longDebit, shortStrike, shortCredit, contracts }, price) => {
    const gained = intrinsicCall(price, num(longStrike)) - intrinsicCall(price, num(shortStrike))
    return (gained - (num(longDebit) - num(shortCredit))) * SHARES_PER_CONTRACT * num(contracts)
  },

  'protective-put': ({ costBasis, putStrike, putPremium, contracts }, price) =>
    ((price - num(costBasis)) + intrinsicPut(price, num(putStrike)) - num(putPremium))
    * SHARES_PER_CONTRACT * num(contracts),

  'collar': ({ costBasis, putStrike, putPremium, callStrike, callCredit, contracts }, price) =>
    ((price - num(costBasis))
      + intrinsicPut(price, num(putStrike))
      - intrinsicCall(price, num(callStrike))
      - (num(putPremium) - num(callCredit)))
    * SHARES_PER_CONTRACT * num(contracts),

  'strangle': ({ putStrike, callStrike, premium, contracts, direction }, price) => {
    const intrinsic = intrinsicPut(price, num(putStrike)) + intrinsicCall(price, num(callStrike))
    const sign = direction === 'long' ? 1 : -1
    return (sign * (intrinsic - num(premium))) * SHARES_PER_CONTRACT * num(contracts)
  },

  // Short put plus a short call spread.
  'jade-lizard': ({ putStrike, shortCall, longCall, credit, contracts }, price) => {
    const putSide = intrinsicPut(price, num(putStrike))
    const callSide = intrinsicCall(price, num(shortCall)) - intrinsicCall(price, num(longCall))
    return (num(credit) - putSide - callSide) * SHARES_PER_CONTRACT * num(contracts)
  },

  // Shares, plus a short call above and a short put below.
  'covered-strangle': ({ costBasis, putStrike, callStrike, credit, contracts }, price) =>
    ((price - num(costBasis))
      + num(credit)
      - intrinsicCall(price, num(callStrike))
      - intrinsicPut(price, num(putStrike)))
    * SHARES_PER_CONTRACT * num(contracts),

  // Long 1 at short+narrow, short 2 at short, long 1 at short-wide, in puts.
  'broken-wing': ({ shortStrike, narrowWing, wideWing, credit, contracts }, price) => {
    const short = num(shortStrike)
    const upper = short + num(narrowWing)
    const lower = short - num(wideWing)
    const value = intrinsicPut(price, upper)
      - 2 * intrinsicPut(price, short)
      + intrinsicPut(price, lower)
    return (value + num(credit)) * SHARES_PER_CONTRACT * num(contracts)
  },

  // One near leg against two far ones. Front is long 1 / short 2; a backspread
  // reverses the signs.
  'ratio-spread': ({ nearStrike, farStrike, credit, contracts, type, structure }, price) => {
    const intrinsic = type === 'put' ? intrinsicPut : intrinsicCall
    const sign = structure === 'back' ? -1 : 1
    const value = sign * (intrinsic(price, num(nearStrike)) - 2 * intrinsic(price, num(farStrike)))
    return (value + num(credit)) * SHARES_PER_CONTRACT * num(contracts)
  },

  'risk-reversal': ({ putStrike, callStrike, netCredit, contracts }, price) =>
    (num(netCredit) - intrinsicPut(price, num(putStrike)) + intrinsicCall(price, num(callStrike)))
    * SHARES_PER_CONTRACT * num(contracts),

  'iron-butterfly': ({ centerStrike, wingWidth, credit, contracts }, price) => {
    const center = num(centerStrike)
    const wing = num(wingWidth)
    const putSide = intrinsicPut(price, center) - intrinsicPut(price, center - wing)
    const callSide = intrinsicCall(price, center) - intrinsicCall(price, center + wing)
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
    case 'long-option': return [num(params.strike)]
    case 'pmcc': return [num(params.longStrike), num(params.shortStrike)]
    case 'protective-put': return [num(params.putStrike), num(params.costBasis)]
    case 'collar': return [num(params.putStrike), num(params.callStrike), num(params.costBasis)]
    case 'strangle': return [num(params.putStrike), num(params.callStrike)]
    case 'ratio-spread': return [num(params.nearStrike), num(params.farStrike)]
    case 'risk-reversal': return [num(params.putStrike), num(params.callStrike)]
    case 'jade-lizard': return [num(params.putStrike), num(params.shortCall), num(params.longCall)]
    case 'covered-strangle': return [num(params.putStrike), num(params.callStrike), num(params.costBasis)]
    case 'broken-wing': return [
      num(params.shortStrike) - num(params.wideWing),
      num(params.shortStrike),
      num(params.shortStrike) + num(params.narrowWing),
    ]
    case 'iron-butterfly': return [
      num(params.centerStrike) - num(params.wingWidth),
      num(params.centerStrike),
      num(params.centerStrike) + num(params.wingWidth),
    ]
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
  if (kind === 'pmcc' && num(params.shortStrike) <= num(params.longStrike)) return false
  if (kind === 'collar' && num(params.callStrike) <= num(params.putStrike)) return false
  if (kind === 'strangle' && num(params.callStrike) < num(params.putStrike)) return false
  if (kind === 'iron-butterfly' && num(params.wingWidth) <= 0) return false
  if (kind === 'jade-lizard' && num(params.longCall) <= num(params.shortCall)) return false
  if (kind === 'risk-reversal' && num(params.callStrike) <= num(params.putStrike)) return false
  if (kind === 'ratio-spread') {
    const near = num(params.nearStrike)
    const far = num(params.farStrike)
    if (params.type === 'put' ? far >= near : far <= near) return false
  }
  if (kind === 'broken-wing' && num(params.wideWing) <= num(params.narrowWing)) return false
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

// `spot` is optional. When given it widens the plotted range and is sampled
// exactly, so a marker for where the underlying actually is can never fall off
// the end of the curve.
export function payoffCurve(kind, params = {}, spot = null) {
  const strikes = strikesFor(kind, params)
  if (!isValid(kind, params, strikes)) return null

  const spotPrice = Number(spot)
  const hasSpot = Number.isFinite(spotPrice) && spotPrice > 0
  const anchors = hasSpot ? [...strikes, spotPrice] : strikes

  const low = Math.min(...anchors)
  const high = Math.max(...anchors)
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
  if (hasSpot) prices.add(spotPrice)

  const points = [...prices]
    .sort((a, b) => a - b)
    .map((price) => ({ price, pnl: payoffAt(kind, params, price) }))

  return {
    points,
    breakevens: findBreakevens(points),
    from,
    to,
    spot: hasSpot ? spotPrice : null,
    pnlAtSpot: hasSpot ? payoffAt(kind, params, spotPrice) : null,
  }
}

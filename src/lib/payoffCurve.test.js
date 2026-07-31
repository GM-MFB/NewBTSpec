import { describe, it, expect } from 'vitest'
import { payoffAt, payoffCurve } from './payoffCurve'

function at(kind, params, price) {
  return payoffAt(kind, params, price)
}

describe('payoffAt — cash-secured put', () => {
  const p = { strike: 380, premium: 2, contracts: 1 }

  it('keeps the full premium above the strike', () => {
    expect(at('wheel-put', p, 400)).toBeCloseTo(200, 6)
    expect(at('wheel-put', p, 380)).toBeCloseTo(200, 6)
  })

  it('crosses zero at strike minus premium', () => {
    expect(at('wheel-put', p, 378)).toBeCloseTo(0, 6)
  })

  it('loses linearly below breakeven', () => {
    expect(at('wheel-put', p, 370)).toBeCloseTo(-800, 6)
    expect(at('wheel-put', p, 360)).toBeCloseTo(-1800, 6)
  })
})

describe('payoffAt — covered call', () => {
  const p = { strike: 390, premium: 1.5, costBasis: 378, contracts: 1 }

  it('caps profit at the call strike', () => {
    // (390 - 378 + 1.50) x 100
    expect(at('wheel-call', p, 390)).toBeCloseTo(1350, 6)
    expect(at('wheel-call', p, 450)).toBeCloseTo(1350, 6)
  })

  it('breaks even at cost basis minus premium', () => {
    expect(at('wheel-call', p, 376.5)).toBeCloseTo(0, 6)
  })

  it('loses below breakeven as the shares fall', () => {
    expect(at('wheel-call', p, 350)).toBeCloseTo((350 - 378 + 1.5) * 100, 6)
  })
})

describe('payoffAt — credit spreads', () => {
  const put = { shortStrike: 36, longStrike: 35, credit: 0.4, contracts: 1, type: 'put' }

  it('keeps the credit above the short put strike', () => {
    expect(at('credit-spread', put, 40)).toBeCloseTo(40, 6)
  })

  it('reaches max loss at or below the long strike', () => {
    expect(at('credit-spread', put, 35)).toBeCloseTo(-60, 6)
    expect(at('credit-spread', put, 20)).toBeCloseTo(-60, 6)
  })

  it('crosses zero at the breakeven', () => {
    expect(at('credit-spread', put, 35.6)).toBeCloseTo(0, 6)
  })

  it('mirrors for a call spread', () => {
    const call = { shortStrike: 105, longStrike: 110, credit: 1.5, contracts: 1, type: 'call' }
    expect(at('credit-spread', call, 100)).toBeCloseTo(150, 6)
    expect(at('credit-spread', call, 110)).toBeCloseTo(-350, 6)
    expect(at('credit-spread', call, 106.5)).toBeCloseTo(0, 6)
  })
})

describe('payoffAt — debit spreads', () => {
  const call = { longStrike: 100, shortStrike: 105, debit: 2, contracts: 1, type: 'call' }

  it('loses the full debit below the long strike', () => {
    expect(at('debit-spread', call, 95)).toBeCloseTo(-200, 6)
    expect(at('debit-spread', call, 100)).toBeCloseTo(-200, 6)
  })

  it('caps profit at the short strike', () => {
    expect(at('debit-spread', call, 105)).toBeCloseTo(300, 6)
    expect(at('debit-spread', call, 130)).toBeCloseTo(300, 6)
  })

  it('crosses zero at the breakeven', () => {
    expect(at('debit-spread', call, 102)).toBeCloseTo(0, 6)
  })
})

describe('payoffAt — iron condor', () => {
  const c = { shortPut: 95, longPut: 90, shortCall: 105, longCall: 110, credit: 1.2, contracts: 1 }

  it('keeps the full credit between the short strikes', () => {
    expect(at('iron-condor', c, 100)).toBeCloseTo(120, 6)
    expect(at('iron-condor', c, 95)).toBeCloseTo(120, 6)
    expect(at('iron-condor', c, 105)).toBeCloseTo(120, 6)
  })

  it('reaches max loss beyond either long strike', () => {
    expect(at('iron-condor', c, 90)).toBeCloseTo(-380, 6)
    expect(at('iron-condor', c, 110)).toBeCloseTo(-380, 6)
    expect(at('iron-condor', c, 60)).toBeCloseTo(-380, 6)
    expect(at('iron-condor', c, 140)).toBeCloseTo(-380, 6)
  })

  it('crosses zero at both breakevens', () => {
    expect(at('iron-condor', c, 93.8)).toBeCloseTo(0, 6)
    expect(at('iron-condor', c, 106.2)).toBeCloseTo(0, 6)
  })
})

describe('payoffCurve', () => {
  it('samples a curve and reports the breakeven for a cash-secured put', () => {
    const curve = payoffCurve('wheel-put', { strike: 380, premium: 2, contracts: 1 })
    expect(curve.points.length).toBeGreaterThan(20)
    expect(curve.breakevens).toEqual([378])
    expect(curve.points[0].price).toBeLessThan(380)
    expect(curve.points.at(-1).price).toBeGreaterThan(380)
  })

  it('includes the strikes exactly so the kinks stay sharp', () => {
    const curve = payoffCurve('credit-spread', { shortStrike: 36, longStrike: 35, credit: 0.4, contracts: 1, type: 'put' })
    const prices = curve.points.map((p) => p.price)
    expect(prices).toContain(36)
    expect(prices).toContain(35)
  })

  it('reports both breakevens for a condor', () => {
    const curve = payoffCurve('iron-condor', { shortPut: 95, longPut: 90, shortCall: 105, longCall: 110, credit: 1.2, contracts: 1 })
    expect(curve.breakevens).toHaveLength(2)
    expect(curve.breakevens[0]).toBeCloseTo(93.8, 6)
    expect(curve.breakevens[1]).toBeCloseTo(106.2, 6)
  })

  it('rises monotonically with price for a cash-secured put', () => {
    const curve = payoffCurve('wheel-put', { strike: 380, premium: 2, contracts: 1 })
    for (let i = 1; i < curve.points.length; i += 1) {
      expect(curve.points[i].pnl).toBeGreaterThanOrEqual(curve.points[i - 1].pnl - 1e-9)
    }
  })

  it('returns null for a calendar spread, which has no expiration payoff', () => {
    expect(payoffCurve('calendar-spread', { debit: 1.5, contracts: 1 })).toBeNull()
  })

  it('returns null when the inputs do not describe a real position', () => {
    expect(payoffCurve('wheel-put', { strike: 0, premium: 2, contracts: 1 })).toBeNull()
    expect(payoffCurve('credit-spread', { shortStrike: 36, longStrike: 36, credit: 0.4, contracts: 1, type: 'put' })).toBeNull()
  })
})

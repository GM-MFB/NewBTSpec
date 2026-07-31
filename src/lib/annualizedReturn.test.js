import { describe, it, expect } from 'vitest'
import { annualizedReturnFor, capitalDeployedFor, daysHeldFor } from './annualizedReturn'

describe('capitalDeployedFor', () => {
  it('uses cost basis for stock', () => {
    expect(capitalDeployedFor({ assetType: 'Stock', shares: 10, avgCost: 100 })).toBe(1000)
  })

  it('uses collateral for a short put, not the premium', () => {
    const csp = { assetType: 'Option', strategy: 'cash_secured_put', shares: 1, strike: 380, avgCost: 2 }
    expect(capitalDeployedFor(csp)).toBe(38000)
  })

  it('uses the strike width for a credit spread', () => {
    const spread = { assetType: 'Option', strategy: 'put_credit_spread', shares: 1, strike: 36, strike2: 35, avgCost: 0.4 }
    expect(capitalDeployedFor(spread)).toBe(100)
  })

  it('uses premium paid for a long option', () => {
    expect(capitalDeployedFor({ assetType: 'Option', strategy: 'call', shares: 2, avgCost: 3 })).toBe(600)
  })
})

describe('daysHeldFor', () => {
  it('counts calendar days between open and close', () => {
    expect(daysHeldFor({ buyDate: '2026-01-01', sellDate: '2026-01-31' })).toBe(30)
  })

  it('returns zero for a same-day close', () => {
    expect(daysHeldFor({ buyDate: '2026-01-10', sellDate: '2026-01-10' })).toBe(0)
  })

  it('returns null when either date is missing or unparseable', () => {
    expect(daysHeldFor({ buyDate: '', sellDate: '2026-01-10' })).toBeNull()
    expect(daysHeldFor({ buyDate: '2026-01-10', sellDate: '' })).toBeNull()
    expect(daysHeldFor({ buyDate: 'nonsense', sellDate: '2026-01-10' })).toBeNull()
  })

  it('returns null when the close predates the open', () => {
    expect(daysHeldFor({ buyDate: '2026-02-01', sellDate: '2026-01-01' })).toBeNull()
  })
})

describe('annualizedReturnFor', () => {
  it('annualizes a stock trade held exactly a year', () => {
    const stock = { status: 'closed', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: 150, buyDate: '2025-01-01', sellDate: '2026-01-01' }
    // 500 profit on 1,000 over 365 days
    expect(annualizedReturnFor(stock)).toBeCloseTo(0.5, 6)
  })

  it('annualizes a short put on its collateral', () => {
    const csp = {
      status: 'closed', assetType: 'Option', strategy: 'cash_secured_put', shares: 1,
      strike: 380, avgCost: 2, sellPrice: 0.5, buyDate: '2026-01-01', sellDate: '2026-01-31',
    }
    // 150 profit on 38,000 collateral over 30 days
    expect(annualizedReturnFor(csp)).toBeCloseTo((150 / 38000) * (365 / 30), 6)
  })

  it('treats a same-day close as one day rather than dividing by zero', () => {
    const sameDay = { status: 'closed', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: 101, buyDate: '2026-01-10', sellDate: '2026-01-10' }
    expect(annualizedReturnFor(sameDay)).toBeCloseTo((10 / 1000) * 365, 6)
    expect(Number.isFinite(annualizedReturnFor(sameDay))).toBe(true)
  })

  it('goes negative on a losing trade', () => {
    const loser = { status: 'closed', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: 90, buyDate: '2025-01-01', sellDate: '2026-01-01' }
    expect(annualizedReturnFor(loser)).toBeCloseTo(-0.1, 6)
  })

  it('returns null for an open position, which has no final return', () => {
    const open = { status: 'open', assetType: 'Stock', shares: 10, avgCost: 100, buyDate: '2025-01-01' }
    expect(annualizedReturnFor(open)).toBeNull()
  })

  it('returns null when dates are missing', () => {
    const noDates = { status: 'closed', assetType: 'Stock', shares: 10, avgCost: 100, sellPrice: 150, buyDate: '', sellDate: '' }
    expect(annualizedReturnFor(noDates)).toBeNull()
  })

  it('returns null for a covered call, whose deployed capital is the shares rather than cash', () => {
    const cc = {
      status: 'closed', assetType: 'Option', strategy: 'covered_call', shares: 1,
      strike: 200, avgCost: 1.2, sellPrice: 0.2, buyDate: '2026-01-01', sellDate: '2026-01-31',
    }
    expect(annualizedReturnFor(cc)).toBeNull()
  })
})

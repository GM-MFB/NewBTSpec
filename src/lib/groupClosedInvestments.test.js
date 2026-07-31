import { describe, it, expect } from 'vitest'
import { groupClosedByDateAndStrategy } from './groupClosedInvestments'

const stock = { id: 's1', status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10' }
const csp = { id: 'o1', status: 'closed', assetType: 'Option', symbol: 'QQQ', shares: 2, avgCost: 1.5, sellPrice: 0.5, sellDate: '2026-01-12', strategy: 'cash_secured_put', strike: 380 }
const spread = { id: 'o2', status: 'closed', assetType: 'Option', symbol: 'SPY', shares: 1, avgCost: 1, sellPrice: 0.2, sellDate: '2026-01-12', strategy: 'put_credit_spread', strike: 36, strike2: 35 }

describe('groupClosedByDateAndStrategy', () => {
  it('groups by close date, most recent first', () => {
    const groups = groupClosedByDateAndStrategy([stock, csp])
    expect(groups.map((g) => g.date)).toEqual(['2026-01-12', '2026-01-10'])
  })

  it('splits each date into strategy groups', () => {
    const groups = groupClosedByDateAndStrategy([csp, spread])
    expect(groups).toHaveLength(1)
    expect(groups[0].groups.map((g) => g.label)).toEqual(['Cash Secured Put', 'Put Credit Spread'])
    expect(groups[0].groups[0].items).toHaveLength(1)
  })

  it('puts stock ahead of option strategies within a date', () => {
    const sameDayStock = { ...stock, sellDate: '2026-01-12' }
    const groups = groupClosedByDateAndStrategy([csp, sameDayStock])
    expect(groups[0].groups.map((g) => g.label)).toEqual(['Stock', 'Cash Secured Put'])
  })

  it('totals realized P&L for each date', () => {
    const groups = groupClosedByDateAndStrategy([stock])
    // (150 - 100) x 10
    expect(groups[0].totalPnl).toBe(500)
  })

  it('labels an option with no strategy from its type and direction rather than dumping it in Other', () => {
    const legacy = {
      id: 'o3', status: 'closed', assetType: 'Option', symbol: 'TSLA', shares: 1,
      avgCost: 2, sellPrice: 1, sellDate: '2026-01-12', strategy: '',
      optionType: 'call', optionDirection: 'long', strike: 300,
    }
    const groups = groupClosedByDateAndStrategy([legacy])
    expect(groups[0].groups[0].label).toBe('Long Call')
  })

  it('falls back to Other for an asset type that is neither stock nor option', () => {
    const bond = { id: 'b1', status: 'closed', assetType: 'Bond', symbol: 'TLT', shares: 1, avgCost: 90, sellPrice: 95, sellDate: '2026-01-12' }
    const groups = groupClosedByDateAndStrategy([bond])
    expect(groups[0].groups[0].label).toBe('Other')
  })

  it('buckets positions with no close date under No Date, sorted last', () => {
    const undated = { ...stock, id: 's2', sellDate: '' }
    const groups = groupClosedByDateAndStrategy([undated, csp])
    expect(groups.map((g) => g.date)).toEqual(['2026-01-12', 'No Date'])
  })

  it('returns an empty list for no investments', () => {
    expect(groupClosedByDateAndStrategy([])).toEqual([])
  })
})

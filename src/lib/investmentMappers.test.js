import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './investmentMappers'

describe('fromRow', () => {
  it('converts a stock row to camelCase, nulls to blank', () => {
    const row = {
      id: '1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', asset_type: 'Stock', sector: 'Tech',
      shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: 140,
      target_price: 200, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }
    expect(fromRow(row)).toEqual({
      id: '1', accountId: 'a1', userId: 'u1', createdAt: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', assetType: 'Stock', sector: 'Tech',
      shares: 10, avgCost: 150, currentPrice: '', buyDate: '2026-01-01',
      status: 'open', sellPrice: '', sellDate: '', stopLoss: 140,
      targetPrice: 200, chartLink: '', notes: '',
      optionType: '', optionDirection: '', strike: '', expiry: '',
      strategy: '', strike2: '',
    })
  })
})

describe('toRow', () => {
  it('derives option_type/option_direction from a non-spread strategy', () => {
    const investment = {
      symbol: 'TSLA', name: '', assetType: 'Option', sector: '',
      shares: '', avgCost: '', buyDate: '2026-01-01', stopLoss: '',
      targetPrice: '', chartLink: '', notes: '', status: 'open',
      strategy: 'cash_secured_put', strike: '200', expiry: '2026-02-01', strike2: '',
    }
    const row = toRow(investment)
    expect(row.option_type).toBe('put')
    expect(row.option_direction).toBe('short')
    expect(row.strategy).toBe('cash_secured_put')
    expect(row.strike).toBe('200')
    expect(row.strike_2).toBeNull()
  })

  it('includes strike_2 for a credit spread strategy', () => {
    const investment = {
      symbol: 'SPY', name: '', assetType: 'Option', sector: '',
      shares: '', avgCost: '', buyDate: '2026-01-01', stopLoss: '',
      targetPrice: '', chartLink: '', notes: '', status: 'open',
      strategy: 'put_credit_spread', strike: '400', expiry: '2026-02-01', strike2: '395',
    }
    const row = toRow(investment)
    expect(row.option_type).toBe('put')
    expect(row.option_direction).toBe('short')
    expect(row.strike_2).toBe('395')
  })

  it('leaves option fields null for a stock investment', () => {
    const investment = {
      symbol: 'AAPL', name: 'Apple', assetType: 'Stock', sector: 'Tech',
      shares: '10', avgCost: '150', buyDate: '2026-01-01', stopLoss: '',
      targetPrice: '', chartLink: '', notes: '', status: 'open',
      strategy: '', strike: '', expiry: '', strike2: '',
    }
    const row = toRow(investment)
    expect(row.option_type).toBeNull()
    expect(row.option_direction).toBeNull()
    expect(row.strategy).toBeNull()
    expect(row.strike_2).toBeNull()
  })
})

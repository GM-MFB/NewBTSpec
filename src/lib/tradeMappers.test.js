import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './tradeMappers'

describe('fromRow', () => {
  it('converts snake_case db row to camelCase trade object', () => {
    const row = {
      id: '1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'option', symbol: 'AAPL', option_type: 'call', strike: 200,
      expiry: '2026-02-01', direction: 'long', quantity: 1,
      entry_price: 5.5, exit_price: null, entry_date: '2026-01-01',
      exit_date: null, status: 'open', fees: 1.5, notes: null, chart_link: null,
    }
    expect(fromRow(row)).toEqual({
      id: '1', accountId: 'a1', userId: 'u1', createdAt: '2026-01-01',
      type: 'option', symbol: 'AAPL', optionType: 'call', strike: 200,
      expiry: '2026-02-01', direction: 'long', quantity: 1,
      entryPrice: 5.5, exitPrice: '', entryDate: '2026-01-01',
      exitDate: '', status: 'open', fees: 1.5, notes: '', chartLink: '',
    })
  })
})

describe('toRow', () => {
  it('converts camelCase trade object to snake_case db row, blanks to null', () => {
    const trade = {
      type: 'futures', symbol: 'ES', optionType: '', strike: '',
      expiry: '', direction: 'short', quantity: 2, entryPrice: 4500,
      exitPrice: '', entryDate: '2026-01-01', exitDate: '',
      status: 'open', fees: 2, notes: '', chartLink: '',
    }
    expect(toRow(trade)).toEqual({
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'short', quantity: 2, entry_price: 4500,
      exit_price: null, entry_date: '2026-01-01', exit_date: null,
      status: 'open', fees: 2, notes: null, chart_link: null,
    })
  })
})

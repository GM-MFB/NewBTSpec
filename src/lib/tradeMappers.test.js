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
      tick_value: null, ticks: null,
    }
    expect(fromRow(row)).toEqual({
      id: '1', accountId: 'a1', userId: 'u1', createdAt: '2026-01-01',
      type: 'option', symbol: 'AAPL', optionType: 'call', strike: 200,
      expiry: '2026-02-01', direction: 'long', quantity: 1,
      entryPrice: 5.5, exitPrice: '', entryDate: '2026-01-01',
      exitDate: '', status: 'open', fees: 1.5, notes: '', chartLink: '',
      tickValue: '', ticks: '',
    })
  })

  it('maps tick_value/ticks to tickValue/ticks and back', () => {
    const row = {
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'MES', option_type: null, strike: null, expiry: null,
      direction: 'long', quantity: 1, entry_price: null, exit_price: null,
      entry_date: '2026-01-01', exit_date: '2026-01-01', status: 'closed',
      fees: 0, notes: null, chart_link: null, tick_value: 1.25, ticks: 8,
    }
    const trade = fromRow(row)
    expect(trade.tickValue).toBe(1.25)
    expect(trade.ticks).toBe(8)
    expect(toRow(trade).tick_value).toBe(1.25)
    expect(toRow(trade).ticks).toBe(8)
  })
})

describe('toRow', () => {
  it('converts camelCase trade object to snake_case db row, blanks to null', () => {
    const trade = {
      type: 'futures', symbol: 'ES', optionType: '', strike: '',
      expiry: '', direction: 'short', quantity: 2, entryPrice: '',
      exitPrice: '', entryDate: '2026-01-01', exitDate: '2026-01-01',
      status: 'closed', fees: 2, notes: '', chartLink: '', tickValue: '', ticks: '',
    }
    expect(toRow(trade)).toEqual({
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'short', quantity: 2, entry_price: null,
      exit_price: null, entry_date: '2026-01-01', exit_date: '2026-01-01',
      status: 'closed', fees: 2, notes: null, chart_link: null,
      tick_value: null, ticks: null,
    })
  })

  it('uppercases the symbol regardless of how it was typed', () => {
    const trade = {
      type: 'futures', symbol: 'es', optionType: '', strike: '',
      expiry: '', direction: 'short', quantity: 2, entryPrice: '',
      exitPrice: '', entryDate: '2026-01-01', exitDate: '',
      status: 'open', fees: 2, notes: '', chartLink: '',
    }
    expect(toRow(trade).symbol).toBe('ES')
  })

  it('maps a blank tickValue/ticks to null', () => {
    expect(toRow({ tickValue: '', ticks: '' }).tick_value).toBeNull()
    expect(toRow({ tickValue: '', ticks: '' }).ticks).toBeNull()
  })
})

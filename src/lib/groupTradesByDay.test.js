import { describe, it, expect } from 'vitest'
import { groupTradesByDay } from './groupTradesByDay'

describe('groupTradesByDay', () => {
  it('groups trades under their exit date', () => {
    const trades = [
      { id: 't1', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 12, exitDate: '2026-07-27', fees: 0 },
      { id: 't2', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 8, exitDate: '2026-07-27', fees: 0 },
      { id: 't3', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 15, exitDate: '2026-07-25', fees: 0 },
    ]
    const groups = groupTradesByDay(trades)
    expect(groups).toHaveLength(2)
    expect(groups[0].date).toBe('2026-07-27')
    expect(groups[0].trades).toHaveLength(2)
    expect(groups[1].date).toBe('2026-07-25')
    expect(groups[1].trades).toHaveLength(1)
  })

  it('sorts groups by date descending (most recent first)', () => {
    const trades = [
      { id: 't1', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 12, exitDate: '2026-06-01', fees: 0 },
      { id: 't2', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 12, exitDate: '2026-07-15', fees: 0 },
      { id: 't3', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 12, exitDate: '2026-07-01', fees: 0 },
    ]
    const groups = groupTradesByDay(trades)
    expect(groups.map((g) => g.date)).toEqual(['2026-07-15', '2026-07-01', '2026-06-01'])
  })

  it('computes the total P&L for each day', () => {
    const trades = [
      { id: 't1', type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-07-27', fees: 0 },
      { id: 't2', type: 'stock', direction: 'long', quantity: 5, entryPrice: 50, exitPrice: 45, exitDate: '2026-07-27', fees: 0 },
    ]
    const groups = groupTradesByDay(trades)
    expect(groups[0].totalPnl).toBe(75) // (110-100)*10 + (45-50)*5 = 100 - 25
  })

  it('groups legacy open trades (no exitDate) under their entryDate, with a null totalPnl', () => {
    const trades = [
      { id: 't1', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: '', entryDate: '2026-07-20', exitDate: '', fees: 0 },
    ]
    const groups = groupTradesByDay(trades)
    expect(groups[0].date).toBe('2026-07-20')
    expect(groups[0].totalPnl).toBeNull()
  })

  it('groups trades with no date at all under "No Date"', () => {
    const trades = [
      { id: 't1', type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: '', entryDate: '', exitDate: '', fees: 0 },
    ]
    const groups = groupTradesByDay(trades)
    expect(groups[0].date).toBe('No Date')
  })

  it('returns an empty array for no trades', () => {
    expect(groupTradesByDay([])).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { buildMonthGrid } from './tradeCalendar'

describe('buildMonthGrid', () => {
  it('returns 6 rows of 7 cells each', () => {
    const rows = buildMonthGrid([], 2026, 0) // January 2026
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(row).toHaveLength(7)
  })

  it('marks in-month days with the correct day numbers', () => {
    const rows = buildMonthGrid([], 2026, 0) // January 2026 has 31 days
    const inMonthCells = rows.flat().filter((c) => c.inMonth)
    expect(inMonthCells).toHaveLength(31)
    expect(inMonthCells[0].dayNum).toBe(1)
    expect(inMonthCells[0].date).toBe('2026-01-01')
    expect(inMonthCells[30].dayNum).toBe(31)
    expect(inMonthCells[30].date).toBe('2026-01-31')
  })

  it('marks leading/trailing days from adjacent months as not in-month', () => {
    const rows = buildMonthGrid([], 2026, 0)
    const outsideCells = rows.flat().filter((c) => !c.inMonth)
    expect(outsideCells.length).toBeGreaterThan(0)
    for (const cell of outsideCells) {
      expect(cell.date).toBeNull()
      expect(cell.pnl).toBeNull()
    }
  })

  it('sums P&L for multiple trades closed on the same day', () => {
    const trades = [
      { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 105, exitDate: '2026-01-15', fees: 0 },
      { type: 'stock', direction: 'long', quantity: 5, entryPrice: 50, exitPrice: 45, exitDate: '2026-01-15', fees: 0 },
    ]
    const rows = buildMonthGrid(trades, 2026, 0)
    const day15 = rows.flat().find((c) => c.date === '2026-01-15')
    expect(day15.pnl).toBe(25) // (105-100)*10 + (45-50)*5 = 50 - 25
  })

  it('leaves days with no trades at pnl null', () => {
    const rows = buildMonthGrid([], 2026, 0)
    const day10 = rows.flat().find((c) => c.date === '2026-01-10')
    expect(day10.pnl).toBeNull()
  })

  it('excludes legacy open trades (no exitDate) from the grid entirely', () => {
    const trades = [
      { type: 'stock', direction: 'long', quantity: 1, entryPrice: 100, exitPrice: '', exitDate: '', fees: 0 },
    ]
    const rows = buildMonthGrid(trades, 2026, 0)
    const totalPnl = rows.flat().reduce((sum, c) => sum + (c.pnl ?? 0), 0)
    expect(totalPnl).toBe(0)
  })
})

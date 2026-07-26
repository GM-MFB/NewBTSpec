import { describe, it, expect } from 'vitest'
import { SECTORS } from './sectorStocks'

describe('SECTORS', () => {
  it('has at least 10 sectors', () => {
    expect(SECTORS.length).toBeGreaterThanOrEqual(10)
  })

  it('gives every sector a name and a non-empty stock list', () => {
    for (const sector of SECTORS) {
      expect(sector.name).toBeTruthy()
      expect(sector.stocks.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate tickers within a single sector', () => {
    for (const sector of SECTORS) {
      const syms = sector.stocks.map((s) => s.sym)
      expect(new Set(syms).size).toBe(syms.length)
    }
  })

  it('gives every stock a symbol and a name', () => {
    for (const sector of SECTORS) {
      for (const stock of sector.stocks) {
        expect(stock.sym).toBeTruthy()
        expect(stock.name).toBeTruthy()
      }
    }
  })
})

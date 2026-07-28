import { describe, it, expect } from 'vitest'
import { pnlFor, tradeTypeLabel } from './tradeStats'

describe('pnlFor', () => {
  it('returns null when exitPrice is missing (legacy open trade)', () => {
    const trade = { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: '', fees: 0 }
    expect(pnlFor(trade)).toBeNull()
  })

  it('computes stock P&L: (exit-entry)*qty - fees, long', () => {
    const trade = { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 105, fees: 1 }
    expect(pnlFor(trade)).toBe(49) // (105-100)*10 - 1
  })

  it('flips sign for a short stock trade', () => {
    const trade = { type: 'stock', direction: 'short', quantity: 10, entryPrice: 100, exitPrice: 105, fees: 0 }
    expect(pnlFor(trade)).toBe(-50) // (100-105)*10
  })

  it('computes option P&L with the x100 contract multiplier', () => {
    const trade = { type: 'option', optionType: 'call', direction: 'long', quantity: 2, entryPrice: 1.5, exitPrice: 2.0, fees: 2 }
    expect(pnlFor(trade)).toBe(98) // (2.0-1.5)*2*100 - 2
  })

  it('computes futures P&L using pointValue', () => {
    const trade = { type: 'futures', direction: 'long', quantity: 1, entryPrice: 4500, exitPrice: 4510, pointValue: 50, fees: 4 }
    expect(pnlFor(trade)).toBe(496) // (4510-4500)*1*50 - 4
  })

  it('treats a blank fees as zero', () => {
    const trade = { type: 'stock', direction: 'long', quantity: 1, entryPrice: 10, exitPrice: 20, fees: '' }
    expect(pnlFor(trade)).toBe(10)
  })
})

describe('tradeTypeLabel', () => {
  it('labels a call option', () => {
    expect(tradeTypeLabel({ type: 'option', optionType: 'call' })).toBe('Call')
  })

  it('labels a put option', () => {
    expect(tradeTypeLabel({ type: 'option', optionType: 'put' })).toBe('Put')
  })

  it('labels futures', () => {
    expect(tradeTypeLabel({ type: 'futures' })).toBe('Futures')
  })

  it('labels stock', () => {
    expect(tradeTypeLabel({ type: 'stock' })).toBe('Stock')
  })
})

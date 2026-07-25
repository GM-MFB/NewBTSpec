import { describe, it, expect } from 'vitest'
import { coverageFor } from './coverage'

describe('coverageFor', () => {
  it('returns null for a non-covered-call investment', () => {
    const investment = { symbol: 'AAPL', strategy: 'call', shares: 1 }
    expect(coverageFor(investment, [])).toBeNull()
  })

  it('returns full coverage when owned shares meet the requirement', () => {
    const investment = { symbol: 'AAPL', strategy: 'covered_call', shares: 1 }
    const stockInvestments = [{ symbol: 'AAPL', shares: 100 }]
    expect(coverageFor(investment, stockInvestments)).toEqual({ owned: 100, required: 100, ratio: 1 })
  })

  it('returns over-coverage when owned shares exceed the requirement', () => {
    const investment = { symbol: 'AAPL', strategy: 'covered_call', shares: 1 }
    const stockInvestments = [{ symbol: 'AAPL', shares: 200 }]
    expect(coverageFor(investment, stockInvestments)).toEqual({ owned: 200, required: 100, ratio: 2 })
  })

  it('returns partial coverage when owned shares are less than required', () => {
    const investment = { symbol: 'AAPL', strategy: 'covered_call', shares: 2 }
    const stockInvestments = [{ symbol: 'AAPL', shares: 100 }]
    expect(coverageFor(investment, stockInvestments)).toEqual({ owned: 100, required: 200, ratio: 0.5 })
  })

  it('returns zero coverage when no matching stock is owned', () => {
    const investment = { symbol: 'AAPL', strategy: 'covered_call', shares: 1 }
    const stockInvestments = [{ symbol: 'TSLA', shares: 100 }]
    expect(coverageFor(investment, stockInvestments)).toEqual({ owned: 0, required: 100, ratio: 0 })
  })

  it('sums shares across multiple stock lots of the same symbol', () => {
    const investment = { symbol: 'AAPL', strategy: 'covered_call', shares: 1 }
    const stockInvestments = [{ symbol: 'AAPL', shares: 40 }, { symbol: 'AAPL', shares: 60 }]
    expect(coverageFor(investment, stockInvestments)).toEqual({ owned: 100, required: 100, ratio: 1 })
  })
})

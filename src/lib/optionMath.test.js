import { describe, it, expect } from 'vitest'
import { collateralFor, potentialPnlFor, optionsCapitalAtRisk } from './optionMath'
import { strategyByValue } from './optionStrategies'

describe('collateralFor', () => {
  it('returns strike x 100 x contracts for a cash secured put', () => {
    const investment = { shares: 2, strike: 380 }
    expect(collateralFor(investment, strategyByValue('cash_secured_put'))).toBe(76000)
  })

  it('returns strike width x 100 x contracts for a credit spread', () => {
    const investment = { shares: 1, strike: 36, strike2: 35 }
    expect(collateralFor(investment, strategyByValue('put_credit_spread'))).toBe(100)
  })

  it('returns blank for a long call/put (no collateral)', () => {
    const investment = { shares: 1, strike: 300 }
    expect(collateralFor(investment, strategyByValue('call'))).toBe('')
  })

  it('returns blank for a covered call (collateralized by owned shares, not cash)', () => {
    const investment = { shares: 1, strike: 450 }
    expect(collateralFor(investment, strategyByValue('covered_call'))).toBe('')
  })
})

describe('potentialPnlFor', () => {
  it('returns contracts x price x 100 for a short strategy', () => {
    const investment = { shares: 2, avgCost: 1.5 }
    expect(potentialPnlFor(investment, strategyByValue('cash_secured_put'))).toBe(300)
  })

  it('returns blank for a long call/put', () => {
    const investment = { shares: 1, avgCost: 5 }
    expect(potentialPnlFor(investment, strategyByValue('call'))).toBe('')
  })
})

describe('optionsCapitalAtRisk', () => {
  it('returns collateral for a short cash secured put', () => {
    const investment = { shares: 2, strike: 380 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('cash_secured_put'))).toBe(76000)
  })

  it('returns collateral for a credit spread', () => {
    const investment = { shares: 1, strike: 36, strike2: 35 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('put_credit_spread'))).toBe(100)
  })

  it('returns 0 for a covered call', () => {
    const investment = { shares: 1, strike: 450 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('covered_call'))).toBe(0)
  })

  it('returns premium paid (contracts x price x 100) for a long call', () => {
    const investment = { shares: 3, avgCost: 2.5 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('call'))).toBe(750)
  })

  it('returns premium paid for a long put', () => {
    const investment = { shares: 1, avgCost: 4 }
    expect(optionsCapitalAtRisk(investment, strategyByValue('put'))).toBe(400)
  })
})

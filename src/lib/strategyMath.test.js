import { describe, it, expect } from 'vitest'
import {
  cashSecuredPut, coveredCall, creditSpread, debitSpread, calendarSpread, ironCondor,
} from './strategyMath'

describe('cashSecuredPut', () => {
  it('computes collateral, profit, breakeven and return for a 380 put at $2.00 over 30 days', () => {
    const r = cashSecuredPut({ strike: 380, premium: 2, contracts: 1, days: 30 })
    expect(r.collateral).toBe(38000)
    expect(r.maxProfit).toBe(200)
    expect(r.breakeven).toBe(378)
    expect(r.returnOnCapital).toBeCloseTo(200 / 38000, 10)
    expect(r.annualized).toBeCloseTo((200 / 38000) * (365 / 30), 10)
  })

  it('scales with contracts', () => {
    const r = cashSecuredPut({ strike: 380, premium: 2, contracts: 3, days: 30 })
    expect(r.collateral).toBe(114000)
    expect(r.maxProfit).toBe(600)
    // Return on capital is per-dollar, so it does not change with size.
    expect(r.returnOnCapital).toBeCloseTo(200 / 38000, 10)
  })

  it('floors a zero-day hold at one day rather than dividing by zero', () => {
    const r = cashSecuredPut({ strike: 380, premium: 2, contracts: 1, days: 0 })
    expect(Number.isFinite(r.annualized)).toBe(true)
    expect(r.annualized).toBeCloseTo((200 / 38000) * 365, 10)
  })

  it('returns nulls when inputs are missing or zero', () => {
    expect(cashSecuredPut({ strike: 0, premium: 2, contracts: 1, days: 30 }).collateral).toBeNull()
    expect(cashSecuredPut({ strike: 380, premium: 2, contracts: 0, days: 30 }).collateral).toBeNull()
    expect(cashSecuredPut({}).maxProfit).toBeNull()
  })
})

describe('coveredCall', () => {
  it('adds premium and the gain to the strike when called away above cost basis', () => {
    const r = coveredCall({ strike: 110, premium: 2, costBasis: 100, contracts: 1 })
    // (2 + 10) x 100
    expect(r.profitIfCalled).toBe(1200)
    expect(r.breakeven).toBe(98)
    expect(r.returnIfCalled).toBeCloseTo(1200 / 10000, 10)
  })

  it('reports a real loss when the call is sold below cost basis, not a clamped zero', () => {
    // A $95 call on a $100 basis for $2.00 loses $3/share if called away.
    const r = coveredCall({ strike: 95, premium: 2, costBasis: 100, contracts: 1 })
    expect(r.profitIfCalled).toBe(-300)
    expect(r.returnIfCalled).toBeCloseTo(-300 / 10000, 10)
  })

  it('breaks even at cost basis less premium', () => {
    expect(coveredCall({ strike: 110, premium: 3.5, costBasis: 100, contracts: 1 }).breakeven).toBe(96.5)
  })

  it('returns nulls without a cost basis', () => {
    expect(coveredCall({ strike: 110, premium: 2, contracts: 1 }).profitIfCalled).toBeNull()
  })
})

describe('creditSpread', () => {
  it('computes a 36/35 put credit spread taken for $0.40', () => {
    const r = creditSpread({ shortStrike: 36, longStrike: 35, credit: 0.4, contracts: 1, type: 'put' })
    expect(r.width).toBeCloseTo(1, 10)
    expect(r.maxProfit).toBeCloseTo(40, 10)
    expect(r.maxLoss).toBeCloseTo(60, 10)
    expect(r.breakeven).toBeCloseTo(35.6, 10)
    expect(r.returnOnRisk).toBeCloseTo(40 / 60, 10)
  })

  it('breaks even above the short strike for a call spread', () => {
    const r = creditSpread({ shortStrike: 105, longStrike: 110, credit: 1.5, contracts: 1, type: 'call' })
    expect(r.breakeven).toBeCloseTo(106.5, 10)
    expect(r.maxLoss).toBeCloseTo(350, 10)
  })

  it('returns nulls for a zero-width spread', () => {
    expect(creditSpread({ shortStrike: 36, longStrike: 36, credit: 0.4, contracts: 1, type: 'put' }).maxLoss).toBeNull()
  })

  it('returns nulls when the credit meets or exceeds the width, which is not a real fill', () => {
    expect(creditSpread({ shortStrike: 36, longStrike: 35, credit: 1, contracts: 1, type: 'put' }).maxLoss).toBeNull()
    expect(creditSpread({ shortStrike: 36, longStrike: 35, credit: 1.5, contracts: 1, type: 'put' }).maxLoss).toBeNull()
  })
})

describe('debitSpread', () => {
  it('computes a 100/105 call debit spread paid for $2.00', () => {
    const r = debitSpread({ longStrike: 100, shortStrike: 105, debit: 2, contracts: 1, type: 'call' })
    expect(r.width).toBeCloseTo(5, 10)
    expect(r.maxProfit).toBeCloseTo(300, 10)
    expect(r.maxLoss).toBeCloseTo(200, 10)
    expect(r.breakeven).toBeCloseTo(102, 10)
  })

  it('breaks even below the long strike for a put spread', () => {
    const r = debitSpread({ longStrike: 100, shortStrike: 95, debit: 2, contracts: 1, type: 'put' })
    expect(r.breakeven).toBeCloseTo(98, 10)
  })

  it('returns nulls when the debit meets or exceeds the width', () => {
    expect(debitSpread({ longStrike: 100, shortStrike: 105, debit: 5, contracts: 1, type: 'call' }).maxProfit).toBeNull()
  })
})

describe('calendarSpread', () => {
  it('reports max loss as the debit paid', () => {
    const r = calendarSpread({ debit: 1.5, contracts: 2 })
    expect(r.maxLoss).toBeCloseTo(300, 10)
  })

  it('deliberately reports no max profit, because it is not closed-form', () => {
    const r = calendarSpread({ debit: 1.5, contracts: 2 })
    expect(r.maxProfit).toBeNull()
  })

  it('returns nulls without a debit', () => {
    expect(calendarSpread({ contracts: 1 }).maxLoss).toBeNull()
  })
})

describe('ironCondor', () => {
  it('computes a 95/90 put and 105/110 call condor taken for $1.20', () => {
    const r = ironCondor({ shortPut: 95, longPut: 90, shortCall: 105, longCall: 110, credit: 1.2, contracts: 1 })
    expect(r.maxProfit).toBeCloseTo(120, 10)
    expect(r.maxLoss).toBeCloseTo(380, 10)
    expect(r.lowerBreakeven).toBeCloseTo(93.8, 10)
    expect(r.upperBreakeven).toBeCloseTo(106.2, 10)
    expect(r.returnOnRisk).toBeCloseTo(120 / 380, 10)
  })

  it('sizes max loss off the wider side, since only one side can finish in the money', () => {
    // Put side 10 wide, call side 5 wide.
    const r = ironCondor({ shortPut: 95, longPut: 85, shortCall: 105, longCall: 110, credit: 2, contracts: 1 })
    expect(r.maxLoss).toBeCloseTo(800, 10)
  })

  it('returns nulls when the credit exceeds the wider width', () => {
    expect(ironCondor({ shortPut: 95, longPut: 90, shortCall: 105, longCall: 110, credit: 5, contracts: 1 }).maxLoss).toBeNull()
  })
})

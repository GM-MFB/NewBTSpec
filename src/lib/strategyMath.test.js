import { describe, it, expect } from 'vitest'
import {
  cashSecuredPut, coveredCall, creditSpread, debitSpread, calendarSpread, ironCondor,
  longOption, poorMansCoveredCall, protectivePut, collar, strangle, ironButterfly,
  jadeLizard, coveredStrangle, brokenWingButterfly, tailHedge, bufferStructure, riskReversal,
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

describe('longOption', () => {
  it('reports no ceiling for a long call, since upside is unbounded', () => {
    const r = longOption({ strike: 100, premium: 3, contracts: 1, type: 'call' })
    expect(r.maxLoss).toBe(300)
    expect(r.maxProfit).toBeNull()
    expect(r.breakeven).toBe(103)
  })

  it('bounds a long put at the underlying reaching zero', () => {
    const r = longOption({ strike: 100, premium: 3, contracts: 1, type: 'put' })
    expect(r.maxLoss).toBe(300)
    expect(r.maxProfit).toBe(9700)
    expect(r.breakeven).toBe(97)
  })
})

describe('poorMansCoveredCall', () => {
  it('computes net debit and the ceiling for a 80/110 diagonal', () => {
    const r = poorMansCoveredCall({ longStrike: 80, longDebit: 25, shortStrike: 110, shortCredit: 2, contracts: 1 })
    expect(r.netDebit).toBe(2300)
    expect(r.maxLoss).toBe(2300)
    // (110 - 80 - 23) x 100
    expect(r.profitCeiling).toBe(700)
    expect(r.breakeven).toBe(103)
  })

  it('refuses a short strike at or below the long strike', () => {
    expect(poorMansCoveredCall({ longStrike: 80, longDebit: 25, shortStrike: 80, shortCredit: 2, contracts: 1 }).maxLoss).toBeNull()
  })
})

describe('protectivePut', () => {
  it('floors the loss at the put strike plus what the put cost', () => {
    const r = protectivePut({ costBasis: 100, putStrike: 95, putPremium: 2, contracts: 1 })
    expect(r.maxLoss).toBe(700)
    expect(r.breakeven).toBe(102)
    expect(r.insuranceCost).toBe(200)
  })

  it('leaves the upside uncapped', () => {
    expect(protectivePut({ costBasis: 100, putStrike: 95, putPremium: 2, contracts: 1 }).maxProfit).toBeNull()
  })
})

describe('collar', () => {
  it('caps both ends and nets the two premiums', () => {
    const r = collar({ costBasis: 100, putStrike: 95, putPremium: 2, callStrike: 110, callCredit: 1.5, contracts: 1 })
    expect(r.netCost).toBeCloseTo(50, 6)
    expect(r.maxLoss).toBeCloseTo(550, 6)
    expect(r.maxProfit).toBeCloseTo(950, 6)
    expect(r.breakeven).toBeCloseTo(100.5, 6)
  })

  it('handles a credit collar, where the call pays for more than the put', () => {
    const r = collar({ costBasis: 100, putStrike: 95, putPremium: 1, callStrike: 110, callCredit: 2, contracts: 1 })
    expect(r.netCost).toBeCloseTo(-100, 6)
    expect(r.breakeven).toBeCloseTo(99, 6)
  })

  it('refuses a call strike at or below the put strike', () => {
    expect(collar({ costBasis: 100, putStrike: 110, putPremium: 2, callStrike: 95, callCredit: 1, contracts: 1 }).maxLoss).toBeNull()
  })
})

describe('strangle', () => {
  it('reports no max loss for a short strangle, because it is unbounded', () => {
    const r = strangle({ putStrike: 95, callStrike: 105, premium: 3, contracts: 1, direction: 'short' })
    expect(r.maxProfit).toBe(300)
    expect(r.maxLoss).toBeNull()
    expect(r.lowerBreakeven).toBe(92)
    expect(r.upperBreakeven).toBe(108)
  })

  it('caps a long strangle loss at the premium paid', () => {
    const r = strangle({ putStrike: 95, callStrike: 105, premium: 3, contracts: 1, direction: 'long' })
    expect(r.maxLoss).toBe(300)
    expect(r.maxProfit).toBeNull()
  })

  it('treats equal strikes as a straddle', () => {
    const r = strangle({ putStrike: 100, callStrike: 100, premium: 6, contracts: 1, direction: 'short' })
    expect(r.lowerBreakeven).toBe(94)
    expect(r.upperBreakeven).toBe(106)
  })
})

describe('ironButterfly', () => {
  it('computes a 100 centre with 10 wide wings for $4.00', () => {
    const r = ironButterfly({ centerStrike: 100, wingWidth: 10, credit: 4, contracts: 1 })
    expect(r.maxProfit).toBe(400)
    expect(r.maxLoss).toBe(600)
    expect(r.lowerBreakeven).toBe(96)
    expect(r.upperBreakeven).toBe(104)
    expect(r.returnOnRisk).toBeCloseTo(400 / 600, 10)
  })

  it('returns nulls when the credit exceeds the wing width', () => {
    expect(ironButterfly({ centerStrike: 100, wingWidth: 10, credit: 12, contracts: 1 }).maxLoss).toBeNull()
  })
})

describe('jadeLizard', () => {
  it('has no upside risk when the credit covers the call spread width', () => {
    const r = jadeLizard({ putStrike: 95, shortCall: 105, longCall: 110, credit: 5, contracts: 1 })
    expect(r.upsideCovered).toBe(true)
    expect(r.upsideRisk).toBe(0)
    expect(r.maxProfit).toBe(500)
  })

  it('leaves upside risk when the credit falls short of the width', () => {
    const r = jadeLizard({ putStrike: 95, shortCall: 105, longCall: 110, credit: 3, contracts: 1 })
    expect(r.upsideCovered).toBe(false)
    expect(r.upsideRisk).toBe(200)
  })

  it('breaks even on the downside like a cash secured put', () => {
    const r = jadeLizard({ putStrike: 95, shortCall: 105, longCall: 110, credit: 5, contracts: 1 })
    expect(r.downsideBreakeven).toBe(90)
    expect(r.maxDownsideLoss).toBe(9000)
  })

  it('refuses a call spread with no width', () => {
    expect(jadeLizard({ putStrike: 95, shortCall: 105, longCall: 105, credit: 5, contracts: 1 }).maxProfit).toBeNull()
  })
})

describe('coveredStrangle', () => {
  it('profits by the call gain plus both premiums when called away', () => {
    const r = coveredStrangle({ costBasis: 100, putStrike: 95, callStrike: 110, credit: 4, contracts: 1 })
    expect(r.maxProfit).toBe(1400)
    expect(r.breakeven).toBe(96)
  })

  it('doubles the share count and blends the basis if the put is assigned', () => {
    const r = coveredStrangle({ costBasis: 100, putStrike: 95, callStrike: 110, credit: 4, contracts: 1 })
    expect(r.sharesIfAssigned).toBe(200)
    // (100 + 95 - 4) / 2
    expect(r.blendedBasis).toBeCloseTo(95.5, 6)
  })

  it('reports the cash needed to honour the short put', () => {
    expect(coveredStrangle({ costBasis: 100, putStrike: 95, callStrike: 110, credit: 4, contracts: 2 }).capitalRequired).toBe(19000)
  })
})

describe('brokenWingButterfly', () => {
  it('peaks at the short strike and risks only the wing difference', () => {
    const r = brokenWingButterfly({ shortStrike: 100, narrowWing: 5, wideWing: 10, credit: 1, contracts: 1 })
    expect(r.maxProfit).toBe(600)
    // (10 - 5 - 1) x 100
    expect(r.maxLoss).toBe(400)
    expect(r.peakStrike).toBe(100)
  })

  it('marks the narrow side risk free when taken for a credit', () => {
    expect(brokenWingButterfly({ shortStrike: 100, narrowWing: 5, wideWing: 10, credit: 1, contracts: 1 }).riskFreeSide).toBe(true)
  })

  it('refuses wings that are not actually broken', () => {
    expect(brokenWingButterfly({ shortStrike: 100, narrowWing: 5, wideWing: 5, credit: 1, contracts: 1 }).maxProfit).toBeNull()
  })
})

describe('tailHedge', () => {
  const base = { portfolioValue: 100000, spotPrice: 500, strikePct: 20, premium: 1.5, contracts: 2, rollsPerYear: 4 }

  it('computes the strike and the annual cost of running the programme', () => {
    const r = tailHedge(base)
    expect(r.strike).toBe(400)
    // 1.50 x 100 x 2 contracts x 4 rolls
    expect(r.annualCost).toBe(1200)
    expect(r.costAsPct).toBeCloseTo(0.012, 10)
  })

  it('pays nothing until the drawdown passes the strike', () => {
    const r = tailHedge(base)
    expect(r.payoffs.find((p) => p.drop === 10).hedgePayoff).toBe(0)
  })

  it('pays convexly once past it', () => {
    const r = tailHedge(base)
    // 40% drop puts spot at 300, so the 400 put is 100 in the money
    expect(r.payoffs.find((p) => p.drop === 40).hedgePayoff).toBe(20000)
    expect(r.payoffs.find((p) => p.drop === 40).netLoss).toBe(20000)
  })

  it('returns nulls for a nonsensical strike percentage', () => {
    expect(tailHedge({ ...base, strikePct: 120 }).annualCost).toBeNull()
  })
})

describe('bufferStructure', () => {
  it('absorbs losses inside the buffer', () => {
    const r = bufferStructure({ portfolioValue: 100000, bufferPct: 15, capPct: 12 })
    expect(r.outcomes.find((o) => o.move === -10).result).toBe(0)
  })

  it('resumes losing beyond the buffer', () => {
    const r = bufferStructure({ portfolioValue: 100000, bufferPct: 15, capPct: 12 })
    expect(r.outcomes.find((o) => o.move === -30).result).toBe(-15)
  })

  it('caps the upside', () => {
    const r = bufferStructure({ portfolioValue: 100000, bufferPct: 15, capPct: 12 })
    expect(r.outcomes.find((o) => o.move === 30).result).toBe(12)
    expect(r.outcomes.find((o) => o.move === 10).result).toBe(10)
  })
})

describe('riskReversal', () => {
  it('loses like a short put and gains without bound', () => {
    const r = riskReversal({ putStrike: 95, callStrike: 110, netCredit: 0.5, contracts: 1 })
    expect(r.maxProfit).toBeNull()
    expect(r.maxLoss).toBeCloseTo(9450, 6)
    expect(r.lowerBreakeven).toBeCloseTo(94.5, 6)
    expect(r.creditKept).toBeCloseTo(50, 6)
  })

  it('refuses a call strike at or below the put strike', () => {
    expect(riskReversal({ putStrike: 110, callStrike: 95, netCredit: 1, contracts: 1 }).maxLoss).toBeNull()
  })
})

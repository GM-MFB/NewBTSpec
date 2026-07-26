import { describe, it, expect } from 'vitest'
import {
  revenueProfitData,
  marginTrendsData,
  yoyGrowthData,
  cashFlowStatementData,
  fcfVsNetIncomeData,
  cashCompositionData,
  balanceSheetCompositionData,
  liquidityLeverageData,
  roeRoaData,
  debtVsFcfData,
  rdSgaData,
  fcfGrowthData,
  ebitdaData,
} from './financialsCharts'

const periods = [
  {
    date: '2023-12-31', revenue: 1000, cogs: 400, grossProfit: 600, rd: 50, sga: 30, ebitda: 300,
    operatingIncome: 250, netIncome: 200, cash: 90, cashAndShortTerm: 140, currentAssets: 450,
    totalAssets: 1900, currentLiabilities: 300, longTermDebt: 380, totalLiabilities: 850,
    equity: 1000, retainedEarnings: 550, operatingCF: 300, capex: -70, freeCF: 230,
    depreciation: 35, dividendsPaid: 15, investingCF: -80, financingCF: -50,
  },
  {
    date: '2024-12-31', revenue: 1200, cogs: 450, grossProfit: 750, rd: 60, sga: 35, ebitda: 380,
    operatingIncome: 300, netIncome: 250, cash: 100, cashAndShortTerm: 150, currentAssets: 500,
    totalAssets: 2000, currentLiabilities: 250, longTermDebt: 400, totalLiabilities: 900,
    equity: 1100, retainedEarnings: 600, operatingCF: 350, capex: -80, freeCF: 270,
    depreciation: 40, dividendsPaid: 20, investingCF: -90, financingCF: -60,
  },
]

describe('revenueProfitData', () => {
  it('maps revenue, gross profit, and net income per period', () => {
    expect(revenueProfitData(periods)).toEqual([
      { date: '2023-12-31', revenue: 1000, grossProfit: 600, netIncome: 200 },
      { date: '2024-12-31', revenue: 1200, grossProfit: 750, netIncome: 250 },
    ])
  })
})

describe('marginTrendsData', () => {
  it('computes gross/operating/net/fcf margins as percentages', () => {
    const result = marginTrendsData(periods)
    expect(result[0].grossMargin).toBe(60)
    expect(result[0].opMargin).toBe(25)
    expect(result[0].netMargin).toBe(20)
    expect(result[0].fcfMargin).toBe(23)
  })

  it('returns null margins when revenue is null', () => {
    const result = marginTrendsData([{ ...periods[0], revenue: null }])
    expect(result[0].grossMargin).toBeNull()
  })
})

describe('yoyGrowthData', () => {
  it('computes revenue and net income growth vs the prior period, skipping the first period', () => {
    const result = yoyGrowthData(periods)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-12-31')
    expect(result[0].revGrowth).toBe(20)
    expect(result[0].niGrowth).toBe(25)
  })
})

describe('cashFlowStatementData', () => {
  it('maps operating CF, free CF, and absolute capex', () => {
    const result = cashFlowStatementData(periods)
    expect(result[0]).toEqual({ date: '2023-12-31', operatingCF: 300, freeCF: 230, capexAbs: 70 })
  })
})

describe('fcfVsNetIncomeData', () => {
  it('maps free cash flow vs net income', () => {
    expect(fcfVsNetIncomeData(periods)[0]).toEqual({ date: '2023-12-31', freeCF: 230, netIncome: 200 })
  })
})

describe('cashCompositionData', () => {
  it('splits cash and short-term-investments-only (cashAndShortTerm minus cash)', () => {
    const result = cashCompositionData(periods)
    expect(result[0]).toEqual({ date: '2023-12-31', cash: 90, shortTermInvestments: 50 })
  })
})

describe('balanceSheetCompositionData', () => {
  it('maps total assets, liabilities, and equity', () => {
    expect(balanceSheetCompositionData(periods)[0]).toEqual({ date: '2023-12-31', totalAssets: 1900, totalLiabilities: 850, equity: 1000 })
  })
})

describe('liquidityLeverageData', () => {
  it('computes current ratio and debt-to-equity', () => {
    const result = liquidityLeverageData(periods)
    expect(result[0].currentRatio).toBe(1.5)
    expect(result[0].debtToEquity).toBe(0.38)
  })

  it('returns null when the denominator is 0 or null', () => {
    const result = liquidityLeverageData([{ ...periods[0], currentLiabilities: 0 }])
    expect(result[0].currentRatio).toBeNull()
  })
})

describe('roeRoaData', () => {
  it('computes ROE and ROA as percentages', () => {
    const result = roeRoaData(periods)
    expect(result[0].roe).toBe(20)
    expect(result[0].roa).toBeCloseTo(10.526, 2)
  })
})

describe('debtVsFcfData', () => {
  it('maps long-term debt vs free cash flow', () => {
    expect(debtVsFcfData(periods)[0]).toEqual({ date: '2023-12-31', longTermDebt: 380, freeCF: 230 })
  })
})

describe('rdSgaData', () => {
  it('maps R&D/SG&A dollar amounts and their percent of revenue', () => {
    const result = rdSgaData(periods)
    expect(result[0].rd).toBe(50)
    expect(result[0].sga).toBe(30)
    expect(result[0].rdPctRevenue).toBe(5)
    expect(result[0].sgaPctRevenue).toBe(3)
  })
})

describe('fcfGrowthData', () => {
  it('computes free cash flow YoY growth, skipping the first period', () => {
    const result = fcfGrowthData(periods)
    expect(result).toHaveLength(1)
    expect(result[0].fcfGrowth).toBeCloseTo(17.39, 1)
  })
})

describe('ebitdaData', () => {
  it('maps EBITDA vs operating income', () => {
    expect(ebitdaData(periods)[0]).toEqual({ date: '2023-12-31', ebitda: 300, operatingIncome: 250 })
  })
})

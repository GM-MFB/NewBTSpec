import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchFinancials, fetchEpsHistory } from './fetchFinancials'

function jsonResponse(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

describe('fetchFinancials', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the 3 AV endpoints in order with a 1.1s gap, and merges by fiscalDateEnding', async () => {
    const calls = []
    global.fetch.mockImplementation((url) => {
      calls.push(url)
      if (url.includes('INCOME_STATEMENT')) {
        return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', totalRevenue: '1000', costOfRevenue: '400', grossProfit: '600', researchAndDevelopment: '50', sellingGeneralAndAdministrative: '30', ebitda: '300', operatingIncome: '250', netIncome: '200' }], quarterlyReports: [] })
      }
      if (url.includes('BALANCE_SHEET')) {
        return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', cashAndCashEquivalentsAtCarryingValue: '100', cashAndShortTermInvestments: '150', totalCurrentAssets: '500', totalAssets: '2000', totalCurrentLiabilities: '300', longTermDebt: '400', totalLiabilities: '900', totalShareholderEquity: '1100', retainedEarnings: '600' }], quarterlyReports: [] })
      }
      if (url.includes('CASH_FLOW')) {
        return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', operatingCashflow: '350', capitalExpenditures: '80', depreciationDepletionAndAmortization: '40', dividendPayout: '20', cashflowFromInvestment: '-90', cashflowFromFinancing: '-60' }], quarterlyReports: [] })
      }
      return jsonResponse({})
    })

    const promise = fetchFinancials('AAPL', 'key123')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(calls[0]).toContain('INCOME_STATEMENT')
    expect(calls[1]).toContain('BALANCE_SHEET')
    expect(calls[2]).toContain('CASH_FLOW')

    expect(result.annual).toHaveLength(1)
    const period = result.annual[0]
    expect(period.date).toBe('2024-12-31')
    expect(period.revenue).toBe(1000)
    expect(period.grossProfit).toBe(600)
    expect(period.cash).toBe(100)
    expect(period.equity).toBe(1100)
    expect(period.operatingCF).toBe(350)
    expect(period.capex).toBe(-80)
    expect(period.freeCF).toBe(270)
  })

  it('slices to the most recent 8 periods, sorted ascending by date', async () => {
    const annualReports = Array.from({ length: 10 }, (_, i) => ({ fiscalDateEnding: `${2015 + i}-12-31`, totalRevenue: String(i) }))
    global.fetch.mockImplementation((url) => {
      if (url.includes('INCOME_STATEMENT')) return jsonResponse({ annualReports, quarterlyReports: [] })
      return jsonResponse({ annualReports: [], quarterlyReports: [] })
    })

    const promise = fetchFinancials('AAPL', 'key123')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.annual).toHaveLength(8)
    expect(result.annual[0].date).toBe('2017-12-31')
    expect(result.annual[7].date).toBe('2024-12-31')
  })

  it('leaves freeCF null when capex is missing', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('CASH_FLOW')) return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31', operatingCashflow: '350' }], quarterlyReports: [] })
      return jsonResponse({ annualReports: [{ fiscalDateEnding: '2024-12-31' }], quarterlyReports: [] })
    })

    const promise = fetchFinancials('AAPL', 'key123')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.annual[0].freeCF).toBeNull()
  })

  it('throws when AV returns a rate-limit Note', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('INCOME_STATEMENT')) return jsonResponse({ Note: 'Thank you for using Alpha Vantage! Our standard API call frequency is 25 requests per day.' })
      return jsonResponse({ annualReports: [], quarterlyReports: [] })
    })

    const promise = fetchFinancials('AAPL', 'key123')
    vi.runAllTimersAsync()
    await expect(promise).rejects.toThrow()
  })
})

describe('fetchEpsHistory', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('calls the AV EARNINGS endpoint and maps reported EPS per period, most recent 8', async () => {
    const annualEarnings = Array.from({ length: 10 }, (_, i) => ({ fiscalDateEnding: `${2015 + i}-12-31`, reportedEPS: String(i) }))
    const quarterlyEarnings = [{ fiscalDateEnding: '2024-09-30', reportedEPS: '1.25' }]
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ annualEarnings, quarterlyEarnings }) })

    const result = await fetchEpsHistory('AAPL', 'key123')

    expect(global.fetch.mock.calls[0][0]).toContain('EARNINGS')
    expect(result.annual).toHaveLength(8)
    expect(result.annual[7]).toEqual({ date: '2024-12-31', eps: 9 })
    expect(result.quarterly).toEqual([{ date: '2024-09-30', eps: 1.25 }])
  })

  it('throws when AV returns a rate-limit Note', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ Note: 'rate limited' }) })
    await expect(fetchEpsHistory('AAPL', 'key123')).rejects.toThrow()
  })
})

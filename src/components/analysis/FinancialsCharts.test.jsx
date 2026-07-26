import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FinancialsCharts from './FinancialsCharts'

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

const TITLES = [
  'Revenue & Profit', 'Margin Trends', 'YoY Growth %', 'EPS Trend',
  'Cash Flow Statement', 'FCF vs Net Income', 'Cash & Short-Term Investments',
  'Balance Sheet Composition', 'Liquidity & Leverage Ratios', 'Return on Equity & Assets',
  'Long-Term Debt vs Free Cash Flow', 'R&D & SG&A Spending', 'FCF Growth YoY %', 'EBITDA',
]

describe('FinancialsCharts', () => {
  it('renders a container with headings for all 14 charts', () => {
    render(<FinancialsCharts periods={periods} eps={null} onFetchEps={vi.fn()} epsLoading={false} />)

    expect(screen.getByTestId('financials-charts')).toBeInTheDocument()
    for (const title of TITLES) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('shows a Fetch EPS Data button in the EPS Trend card when eps is not loaded', () => {
    render(<FinancialsCharts periods={periods} eps={null} onFetchEps={vi.fn()} epsLoading={false} />)
    expect(screen.getByRole('button', { name: /fetch eps data/i })).toBeInTheDocument()
  })

  it('calls onFetchEps when the button is clicked', async () => {
    const onFetchEps = vi.fn()
    render(<FinancialsCharts periods={periods} eps={null} onFetchEps={onFetchEps} epsLoading={false} />)
    await userEvent.click(screen.getByRole('button', { name: /fetch eps data/i }))
    expect(onFetchEps).toHaveBeenCalled()
  })

  it('does not show the fetch button once eps data is loaded', () => {
    render(<FinancialsCharts periods={periods} eps={[{ date: '2024-12-31', eps: 5.2 }]} onFetchEps={vi.fn()} epsLoading={false} />)
    expect(screen.queryByRole('button', { name: /fetch eps data/i })).not.toBeInTheDocument()
  })

  it('shows an insufficient-data message for growth charts when there is only one period', () => {
    render(<FinancialsCharts periods={[periods[0]]} eps={null} onFetchEps={vi.fn()} epsLoading={false} />)
    expect(screen.getAllByText(/at least two periods/i).length).toBeGreaterThan(0)
  })
})

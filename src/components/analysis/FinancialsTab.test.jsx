import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FinancialsTab from './FinancialsTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials, fetchEpsHistory } from '../../lib/fetchFinancials'
import { getSharedCache, saveSharedCache } from '../../lib/financialsSharedCache'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchFinancials')
vi.mock('../../lib/financialsSharedCache')

const investments = [
  { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 },
]

const sampleData = {
  annual: [
    { date: '2023-12-31', revenue: 1000, cogs: 400, grossProfit: 600, rd: 50, sga: 30, ebitda: 300, operatingIncome: 250, netIncome: 200, cash: 90, cashAndShortTerm: 140, currentAssets: 450, totalAssets: 1900, currentLiabilities: 280, longTermDebt: 380, totalLiabilities: 850, equity: 1050, retainedEarnings: 550, operatingCF: 300, capex: -70, freeCF: 230, depreciation: 35, dividendsPaid: 15, investingCF: -80, financingCF: -50 },
    { date: '2024-12-31', revenue: 1200, cogs: 450, grossProfit: 750, rd: 60, sga: 35, ebitda: 380, operatingIncome: 300, netIncome: 250, cash: 100, cashAndShortTerm: 150, currentAssets: 500, totalAssets: 2000, currentLiabilities: 300, longTermDebt: 400, totalLiabilities: 900, equity: 1100, retainedEarnings: 600, operatingCF: 350, capex: -80, freeCF: 270, depreciation: 40, dividendsPaid: 20, investingCF: -90, financingCF: -60 },
  ],
  quarterly: [
    { date: '2024-09-30', revenue: 290, cogs: 110, grossProfit: 180, rd: 15, sga: 9, ebitda: 95, operatingIncome: 75, netIncome: 60, cash: 100, cashAndShortTerm: 150, currentAssets: 500, totalAssets: 2000, currentLiabilities: 300, longTermDebt: 400, totalLiabilities: 900, equity: 1100, retainedEarnings: 600, operatingCF: 90, capex: -20, freeCF: 70, depreciation: 10, dividendsPaid: 5, investingCF: -22, financingCF: -15 },
  ],
}

describe('FinancialsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    getSharedCache.mockResolvedValue(null)
    saveSharedCache.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('shows a Key Required state when there is no Alpha Vantage key', () => {
    useUserSettings.mockReturnValue({ avKey: '', finnhubKey: '', loading: false })
    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('shows a symbol chip for each open stock investment', () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'AAPL' })).toBeInTheDocument()
  })

  it('shows the active symbol prominently at the top once researched, and highlights its chip', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
    expect(screen.getByTestId('fin-active-symbol')).toHaveTextContent('AAPL')
    expect(screen.getByRole('button', { name: 'AAPL' })).toHaveClass('fin-chip--active')
  })

  it('fetches and renders the three statement tables when a symbol is researched', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
    expect(screen.getByText('Balance Sheet')).toBeInTheDocument()
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
  })

  it('uses the Supabase shared cache instead of fetching when available', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    getSharedCache.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
    expect(fetchFinancials).not.toHaveBeenCalled()
  })

  it('defaults to Annual and switches periods when Quarterly is clicked', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())

    expect(screen.getAllByText('2024-12-31').length).toBeGreaterThan(0)
    expect(screen.queryByText('2024-09-30')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^quarterly$/i }))
    expect(screen.getAllByText('2024-09-30').length).toBeGreaterThan(0)
  })

  it('does not crash when a metric is null for a period', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue({
      annual: [{ date: '2024-12-31', revenue: null, cogs: null, grossProfit: null, rd: null, sga: null, ebitda: null, operatingIncome: null, netIncome: null, cash: null, cashAndShortTerm: null, currentAssets: null, totalAssets: null, currentLiabilities: null, longTermDebt: null, totalLiabilities: null, equity: null, retainedEarnings: null, operatingCF: null, capex: null, freeCF: null, depreciation: null, dividendsPaid: null, investingCF: null, financingCF: null }],
      quarterly: [],
    })

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
  })

  it('defaults to Numbers view and switches to Charts when toggled', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /^numbers$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('financials-charts')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^charts$/i }))

    expect(screen.getByTestId('financials-charts')).toBeInTheDocument()
    expect(screen.queryByText('Income Statement')).not.toBeInTheDocument()
  })

  it('fetches EPS data on demand from the charts view and passes it through', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)
    fetchEpsHistory.mockResolvedValue({ annual: [{ date: '2024-12-31', eps: 5.2 }], quarterly: [] })

    render(<MemoryRouter><FinancialsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByText('Income Statement')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^charts$/i }))

    await userEvent.click(screen.getByRole('button', { name: /fetch eps data/i }))

    expect(fetchEpsHistory).toHaveBeenCalledWith('AAPL', 'avkey123')
    await waitFor(() => expect(screen.queryByRole('button', { name: /fetch eps data/i })).not.toBeInTheDocument())
  })
})

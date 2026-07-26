import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DCFTab from './DCFTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFinancials } from '../../lib/fetchFinancials'
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
    { date: '2022-12-31', freeCF: 80, cash: 40, cashAndShortTerm: 60, longTermDebt: 20 },
    { date: '2023-12-31', freeCF: 90, cash: 45, cashAndShortTerm: 65, longTermDebt: 22 },
    { date: '2024-12-31', freeCF: 100, cash: 50, cashAndShortTerm: 70, longTermDebt: 25 },
  ],
  quarterly: [],
}

describe('DCFTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    getSharedCache.mockResolvedValue(null)
    saveSharedCache.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('shows a Key Required state when there is no Alpha Vantage key', () => {
    useUserSettings.mockReturnValue({ avKey: '', finnhubKey: '', loading: false })
    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('auto-researches the first stock and renders intrinsic value results', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'AAPL' })).toHaveClass('fin-chip--active')
  })

  it('renders the 30-cell sensitivity grid', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())

    expect(screen.getAllByTestId('sensitivity-cell')).toHaveLength(30)
  })

  it('updates results when the Base FCF override is changed', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue(sampleData)
    localStorage.setItem('bt_fundamentals_cache', JSON.stringify({ AAPL: { profile: { shareOutstanding: 100 } } }))

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())

    const before = screen.getByTestId('intrinsic-value').textContent
    const baseFcfInput = screen.getByLabelText(/base fcf/i)
    await userEvent.clear(baseFcfInput)
    await userEvent.type(baseFcfInput, '10B')

    await waitFor(() => expect(screen.getByTestId('intrinsic-value').textContent).not.toBe(before))
  })

  it('does not crash when there is only 1 annual period (no implied growth)', async () => {
    useUserSettings.mockReturnValue({ avKey: 'avkey123', finnhubKey: '', loading: false })
    fetchFinancials.mockResolvedValue({ annual: [sampleData.annual[0]], quarterly: [] })

    render(<MemoryRouter><DCFTab investments={investments} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Intrinsic Value')).toBeInTheDocument())
  })
})

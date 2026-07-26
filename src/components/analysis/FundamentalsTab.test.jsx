import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FundamentalsTab from './FundamentalsTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchFundamentals')

const investments = [
  { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 },
]

describe('FundamentalsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    fetchPeers.mockResolvedValue([])
  })

  it('shows a Key Required state when there is no Finnhub key', () => {
    useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', loading: false })
    render(<MemoryRouter><FundamentalsTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('shows a symbol chip for each open stock investment', () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    render(<MemoryRouter><FundamentalsTab investments={investments} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'AAPL' })).toBeInTheDocument()
  })

  it('fetches and renders the Valuation panel when a symbol chip is clicked', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue({
      profile: { name: 'Apple Inc', exchange: 'NASDAQ', finnhubIndustry: 'Technology' },
      quote: { c: 165, pc: 160, h: 167, l: 159 },
      metrics: { peBasicExclExtraTTM: 28, marketCapitalization: 2_500_000 },
      recs: null,
      targets: null,
      news: [],
      earnings: null,
    })

    render(<MemoryRouter><FundamentalsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Valuation')).toBeInTheDocument())
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
  })

  it('shows Your Position for a symbol that matches an open investment', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue({
      profile: { name: 'Apple Inc' }, quote: { c: 165, pc: 160 }, metrics: {}, recs: null, targets: null, news: [], earnings: null,
    })

    render(<MemoryRouter><FundamentalsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Your Position')).toBeInTheDocument())
  })

  it('shows the ETF info card and skips fetching for a known ETF', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    render(<MemoryRouter><FundamentalsTab investments={investments} /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/add symbol/i), 'SPY{enter}')

    expect(await screen.findByText(/no financials available for etfs/i)).toBeInTheDocument()
    expect(fetchFundamentals).not.toHaveBeenCalled()
  })

  it('does not crash the Valuation panel when metrics is null', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue({
      profile: { name: 'Apple Inc' }, quote: { c: 165, pc: 160 }, metrics: null, recs: null, targets: null, news: [], earnings: null,
    })

    render(<MemoryRouter><FundamentalsTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())
  })
})

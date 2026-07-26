import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrontierTab from './FrontierTab'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchQuote } from '../../lib/finnhub'

vi.mock('../../lib/fetchCorrelations')
vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/finnhub')

describe('FrontierTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCorrelations.mockResolvedValue({ corrMap: {}, paramsMap: {} })
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    localStorage.clear()
  })

  it('shows a minimum-positions message with fewer than 2 open positions', () => {
    render(<FrontierTab investments={[{ symbol: 'AAPL', assetType: 'Stock', shares: 10, currentPrice: 150 }]} />)
    expect(screen.getByText(/at least 2/i)).toBeInTheDocument()
  })

  it('renders FrontierPanel with real portfolio weights for 2+ positions', async () => {
    const investments = [
      { symbol: 'AAPL', assetType: 'Stock', shares: 10, currentPrice: 150 },
      { symbol: 'SPY', assetType: 'ETF', shares: 5, currentPrice: 500 },
    ]
    render(<FrontierTab investments={investments} />)

    await waitFor(() => expect(fetchCorrelations).toHaveBeenCalledWith(['AAPL', 'SPY']))
    expect(screen.getAllByText('Your Portfolio').length).toBeGreaterThan(0)
  })

  it('defaults to My Portfolio mode with no incomingSymbols', () => {
    const investments = [
      { symbol: 'AAPL', assetType: 'Stock', shares: 10, currentPrice: 150 },
      { symbol: 'SPY', assetType: 'ETF', shares: 5, currentPrice: 500 },
    ]
    render(<FrontierTab investments={investments} />)
    expect(screen.getByRole('button', { name: /^my portfolio$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('seeds Custom Set mode with incomingSymbols on mount', () => {
    render(<FrontierTab investments={[]} incomingSymbols={['NVDA', 'AMD']} />)
    expect(screen.getByRole('button', { name: /^custom set$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AMD').length).toBeGreaterThan(0)
  })

  it('lets the user add symbols in Custom Set mode and renders the frontier once there are 2+', async () => {
    render(<FrontierTab investments={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /^custom set$/i }))

    expect(screen.getByText(/add at least 2 symbols/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/add symbol/i), 'NVDA{enter}')
    await userEvent.type(screen.getByLabelText(/add symbol/i), 'AMD{enter}')

    await waitFor(() => expect(screen.getAllByText('Your Portfolio').length).toBeGreaterThan(0))
  })

  it('shows a Fetch button in Custom Set mode that populates prices via fetchQuote', async () => {
    fetchQuote.mockResolvedValue({ c: 123.45 })
    render(<FrontierTab investments={[]} incomingSymbols={['NVDA', 'AMD']} />)

    await userEvent.click(screen.getByRole('button', { name: /^fetch$/i }))

    await waitFor(() => expect(fetchQuote).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText('$123.45').length).toBeGreaterThan(0)
  })
})

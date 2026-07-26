import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OptimizerTab from './OptimizerTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { fetchQuote } from '../../lib/finnhub'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchCorrelations')
vi.mock('../../lib/finnhub')

const investments = [
  { symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: 150 },
  { symbol: 'SPY', assetType: 'ETF', shares: 5, avgCost: 500, currentPrice: 500 },
]

describe('OptimizerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchCorrelations.mockResolvedValue({ corrMap: {}, paramsMap: {} })
  })

  it('defaults to portfolio mode using open investments as the assumptions table rows', () => {
    render(<OptimizerTab investments={investments} />)
    expect(screen.getByRole('rowheader', { name: /aapl/i })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: /spy/i })).toBeInTheDocument()
  })

  it('defaults the simulation-count selector to Standard (6000)', () => {
    render(<OptimizerTab investments={investments} />)
    expect(screen.getByRole('button', { name: /^standard$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('fetches live quotes one-by-one when Fetch is clicked', async () => {
    fetchQuote.mockResolvedValue({ c: 999 })
    render(<OptimizerTab investments={investments} />)

    await userEvent.click(screen.getByRole('button', { name: /^fetch$/i }))

    await waitFor(() => expect(fetchQuote).toHaveBeenCalledTimes(2))
    expect(fetchQuote).toHaveBeenCalledWith('AAPL', 'key123')
    expect(fetchQuote).toHaveBeenCalledWith('SPY', 'key123')
  })
})

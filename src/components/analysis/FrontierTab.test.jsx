import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FrontierTab from './FrontierTab'
import { fetchCorrelations } from '../../lib/fetchCorrelations'

vi.mock('../../lib/fetchCorrelations')

describe('FrontierTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCorrelations.mockResolvedValue({ corrMap: {}, paramsMap: {} })
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
    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
  })
})

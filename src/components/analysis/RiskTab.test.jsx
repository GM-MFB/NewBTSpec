import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RiskTab from './RiskTab'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

const investments = [
  { symbol: 'AAPL', assetType: 'Stock', shares: 20, currentPrice: 150, avgCost: 140, stopLoss: 130 },
  { symbol: 'SPY', assetType: 'ETF', shares: 4, currentPrice: 500, avgCost: 480, stopLoss: null },
]

describe('RiskTab', () => {
  beforeEach(() => {
    setComputedParams({ AAPL: { r: 0.15, s: 0.27 }, SPY: { r: 0.10, s: 0.16 } })
    setRealCorrelations({ AAPL: { SPY: 0.5 } })
  })

  it('renders the 4 hero tiles', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/portfolio beta/i)).toBeInTheDocument()
    expect(screen.getByText(/1-day 95% var/i)).toBeInTheDocument()
    expect(screen.getByText(/diversification score/i)).toBeInTheDocument()
    expect(screen.getAllByText(/stop coverage/i).length).toBeGreaterThan(0)
  })

  it('shows a coverage warning banner when stop coverage is below 80%', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/coverage.*below 80/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FrontierPanel from './FrontierPanel'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

describe('FrontierPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setComputedParams({ AAPL: { r: 0.15, s: 0.20 }, SPY: { r: 0.10, s: 0.15 } })
    setRealCorrelations({ AAPL: { SPY: 0.5 } })
  })

  it('renders the frontier chart with 3 reference points labeled', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params" nSim={300} />)

    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Max Diversification')).toBeInTheDocument()
    expect(screen.getByText('Max Sharpe')).toBeInTheDocument()
  })

  it('renders a rebalancing table row per symbol', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params" nSim={300} />)

    expect(screen.getByRole('rowheader', { name: /aapl/i })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: /spy/i })).toBeInTheDocument()
  })
})

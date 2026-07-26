import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('expands the assumptions editor and persists an override to localStorage', async () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_2" nSim={300} />)

    await userEvent.click(screen.getByRole('button', { name: /adjust expected returns/i }))
    const returnInput = screen.getByLabelText(/aapl.*return/i)
    fireEvent.change(returnInput, { target: { value: '25' } })

    const stored = JSON.parse(localStorage.getItem('test_ef_params_2'))
    expect(stored.AAPL.r).toBeCloseTo(0.25, 5)
  })

  it('marks a symbol in extraSymbols as "new" in the assumptions editor', async () => {
    render(
      <FrontierPanel
        symbols={['AAPL']}
        weights={[1]}
        storageKey="test_ef_params_3"
        mode="combined"
        extraSymbols={['SPY']}
        priceMap={{ SPY: 500 }}
        nSim={300}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /adjust expected returns/i }))
    expect(screen.getByText('SPY (new)')).toBeInTheDocument()
  })
})

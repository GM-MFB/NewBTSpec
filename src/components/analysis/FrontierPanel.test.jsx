import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrontierPanel, { FrontierHoverTooltip } from './FrontierPanel'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

describe('FrontierPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setComputedParams({ AAPL: { r: 0.15, s: 0.20 }, SPY: { r: 0.10, s: 0.15 } })
    setRealCorrelations({ AAPL: { SPY: 0.5 } })
  })

  it('renders the frontier chart with 3 reference points labeled', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params" nSim={300} />)

    expect(screen.getAllByText('Your Portfolio').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Max Diversification').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Max Sharpe').length).toBeGreaterThan(0)
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
    expect(document.querySelector('.frontier-assumptions')).toHaveTextContent('SPY (new)')
  })

  it('renders 3 stat cards with title, subtitle, and headline stats', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_4" nSim={300} />)

    expect(screen.getByText('Current allocation')).toBeInTheDocument()
    expect(screen.getByText('Best correlation spread')).toBeInTheDocument()
    expect(screen.getByText('Best risk-adjusted return')).toBeInTheDocument()
    expect(screen.getAllByText('Exp. Annual Return')).toHaveLength(3)
    expect(screen.getAllByText('Sharpe Ratio')).toHaveLength(3)
  })

  it('renders one allocation bar row per symbol per card, sorted by that card\'s weight', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_5" nSim={300} />)

    expect(screen.getAllByText('Suggested Allocation')).toHaveLength(3)
    const allocationRows = document.querySelectorAll('.frontier-allocation-row')
    expect(allocationRows.length).toBe(6)
  })

  it('gives each symbol a consistent color between its allocation bar and its rebalancing-table dot', () => {
    render(
      <FrontierPanel
        symbols={['AAPL', 'SPY']}
        weights={[0.6, 0.4]}
        storageKey="test_ef_params_colors"
        priceMap={{ AAPL: 150, SPY: 500 }}
        nSim={300}
      />,
    )
    const aaplBarColor = document.querySelector('.frontier-allocation-symbol').style.color
    const aaplDotColor = document.querySelector('.frontier-symbol-dot').style.background
    expect([aaplBarColor, aaplDotColor].every((c) => c.length > 0)).toBe(true)
  })

  it('shows the total portfolio value header above the rebalancing table', () => {
    render(
      <FrontierPanel
        symbols={['AAPL', 'SPY']}
        weights={[0.6, 0.4]}
        storageKey="test_ef_params_6"
        priceMap={{ AAPL: 150, SPY: 500 }}
        nSim={300}
      />,
    )
    expect(screen.getByText(/based on total portfolio value of/i)).toBeInTheDocument()
  })

  it('shows a colored symbol dot, price, and share count in the rebalancing table', () => {
    render(
      <FrontierPanel
        symbols={['AAPL', 'SPY']}
        weights={[0.6, 0.4]}
        storageKey="test_ef_params_7"
        priceMap={{ AAPL: 150, SPY: 500 }}
        nSim={300}
      />,
    )
    const aaplCell = screen.getByRole('rowheader', { name: /aapl/i })
    expect(aaplCell).toHaveTextContent('$150.00')
    expect(document.querySelector('.frontier-symbol-dot')).toBeTruthy()
  })

  it('shows a "(new)" badge for a combined-mode extra symbol in the rebalancing table', () => {
    render(
      <FrontierPanel
        symbols={['AAPL']}
        weights={[1]}
        storageKey="test_ef_params_8"
        mode="combined"
        extraSymbols={['SPY']}
        priceMap={{ SPY: 500 }}
        nSim={300}
      />,
    )
    expect(screen.getByRole('rowheader', { name: /spy.*new/i })).toBeInTheDocument()
  })

  it('shows colored Buy/Sell/Hold action text with a %Δ line', () => {
    render(
      <FrontierPanel
        symbols={['AAPL', 'SPY']}
        weights={[0.6, 0.4]}
        storageKey="test_ef_params_9"
        priceMap={{ AAPL: 150, SPY: 500 }}
        nSim={300}
      />,
    )
    expect(document.querySelectorAll('.frontier-action-buy, .frontier-action-sell, .frontier-action-hold').length).toBeGreaterThan(0)
  })

  it('keeps each frontier point\'s weights available for the hover tooltip', () => {
    render(<FrontierPanel symbols={['AAPL', 'SPY']} weights={[0.6, 0.4]} storageKey="test_ef_params_hover" nSim={300} />)
    expect(screen.getAllByText('Your Portfolio').length).toBeGreaterThan(0)
  })
})

describe('FrontierHoverTooltip', () => {
  const colorMap = { AAPL: '#3987e5', SPY: '#d95926', TLT: '#199e70' }

  it('renders nothing when inactive', () => {
    const { container } = render(
      <FrontierHoverTooltip active={false} payload={[]} symbols={['AAPL', 'SPY']} colorMap={colorMap} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the payload has no weights', () => {
    const payload = [{ payload: { vol: 12, ret: 8 } }]
    const { container } = render(
      <FrontierHoverTooltip active payload={payload} symbols={['AAPL', 'SPY']} colorMap={colorMap} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the Return/Vol header and a sorted, filtered allocation list', () => {
    const payload = [{ payload: { vol: 12.34, ret: 8.9, weights: [0.003, 0.6, 0.397] } }]
    render(<FrontierHoverTooltip active payload={payload} symbols={['AAPL', 'SPY', 'TLT']} colorMap={colorMap} />)

    expect(screen.getByText(/return 8\.9%/i)).toBeInTheDocument()
    expect(screen.getByText(/vol 12\.3%/i)).toBeInTheDocument()
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
    const symbolEls = screen.getAllByText(/^(SPY|TLT)$/)
    expect(symbolEls.map((el) => el.textContent)).toEqual(['SPY', 'TLT'])
  })

  it('renders a title line when the point has a label', () => {
    const payload = [{ payload: { vol: 10, ret: 5, weights: [1, 0, 0], label: 'Your Portfolio' } }]
    render(<FrontierHoverTooltip active payload={payload} symbols={['AAPL', 'SPY', 'TLT']} colorMap={colorMap} />)
    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
  })
})

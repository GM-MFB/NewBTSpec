import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('renders 6 expandable stress test scenarios, expanding to a sorted per-position table', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    render(<RiskTab investments={investments} />)

    expect(screen.getByText(/^Bull Run/)).toBeInTheDocument()
    expect(screen.getByText(/^2008-Level/)).toBeInTheDocument()

    await userEvent.click(screen.getByText(/^Bear Market/))
    expect(screen.getAllByText(/aapl|spy/i).length).toBeGreaterThan(0)
  })

  it('wraps every table in a horizontal scroll container so it cannot overflow the page on mobile', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const withOption = [
      ...investments,
      { symbol: 'MSFT', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'cash_secured_put', strike: 130 },
    ]
    const { container } = render(<RiskTab investments={withOption} />)
    await userEvent.click(screen.getByText(/^Bear Market/))

    const tables = container.querySelectorAll('table')
    expect(tables).toHaveLength(3)
    for (const table of tables) {
      expect(table.parentElement).toHaveClass('risk-table-wrap')
    }
  })

  it('renders risk contribution rows with outsized/efficient flags', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText('Risk Contribution')).toBeInTheDocument()
    expect(screen.getAllByText(/AAPL|SPY/).length).toBeGreaterThan(0)
  })

  it('shows a caption noting options have a defined max loss instead of a stop', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/options have a defined max loss/i)).toBeInTheDocument()
  })

  it('shows a caption framing stress tests as a simplified bound, not a priced options model', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/simplified bound, not a priced options model/i)).toBeInTheDocument()
  })

  it('renders distinct risk contribution rows without duplicate keys when a stock and an option share a symbol', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const withSharedSymbol = [
      ...investments,
      { symbol: 'AAPL', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'cash_secured_put', strike: 130 },
    ]
    render(<RiskTab investments={withSharedSymbol} />)

    const contributionTable = screen.getByText('Risk Contribution').closest('section').querySelector('table')
    const aaplRows = within(contributionTable).getAllByText('AAPL')
    expect(aaplRows).toHaveLength(2)
    expect(errorSpy.mock.calls.flat().join(' ')).not.toMatch(/same key/i)
    errorSpy.mockRestore()
  })

  it('shows a "No open option positions" note when there are no option positions', () => {
    render(<RiskTab investments={investments} />)
    expect(screen.getByText(/no open option positions/i)).toBeInTheDocument()
  })

  it('renders an Options Risk row with capital at risk for a short cash secured put', () => {
    const withOption = [
      ...investments,
      { symbol: 'MSFT', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'cash_secured_put', strike: 130 },
    ]
    render(<RiskTab investments={withOption} />)
    expect(screen.getByText('Cash Secured Put')).toBeInTheDocument()
    expect(screen.getByText('$26,000.00')).toBeInTheDocument()
    expect(screen.getByTestId('options-total-risk')).toHaveTextContent('$26,000.00')
  })

  it('labels a covered call as Covered based on its strategy, not its numeric capital at risk', () => {
    const withCoveredCall = [
      ...investments,
      { symbol: 'AAPL', assetType: 'Option', shares: 1, strategy: 'covered_call', strike: 200 },
    ]
    render(<RiskTab investments={withCoveredCall} />)
    expect(screen.getByText('Covered Call')).toBeInTheDocument()
    expect(screen.getByText('Covered')).toBeInTheDocument()
  })

  it('does not label a long call with a missing cost basis as Covered', () => {
    const withBadLongCall = [
      ...investments,
      { symbol: 'MSFT', assetType: 'Option', shares: 1, strategy: 'call', strike: 400 },
    ]
    render(<RiskTab investments={withBadLongCall} />)
    expect(screen.queryByText('Covered')).not.toBeInTheDocument()
  })

  it('includes an option position in an expanded stress scenario with a bounded impact', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const withOption = [
      ...investments,
      { symbol: 'MSFT', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'cash_secured_put', strike: 130 },
    ]
    render(<RiskTab investments={withOption} />)

    await userEvent.click(screen.getByText(/^Bear Market/))

    // MSFT also appears in the always-rendered Options Risk table, so scope
    // the query to the expanded stress scenario's own table.
    const table = screen.getByTestId('stress-scenario-table')
    const msftRow = within(table).getByText('MSFT').closest('tr')
    expect(msftRow).toHaveTextContent('-$26,000.00')
    expect(msftRow).toHaveTextContent('—')
  })
})

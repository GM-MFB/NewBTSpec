import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SymbolPanels from './SymbolPanels'

const fullResult = {
  profile: { name: 'Apple Inc', exchange: 'NASDAQ', finnhubIndustry: 'Technology' },
  quote: { c: 165, pc: 160 },
  metrics: { peBasicExclExtraTTM: 28.456789, roeTTM: 15, marketCapitalization: 2_500_000 },
  recs: null,
  targets: null,
  news: [],
  earnings: null,
}

describe('SymbolPanels', () => {
  it('renders the header and Valuation panel', () => {
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
    expect(screen.getByText('Valuation')).toBeInTheDocument()
  })

  it('rounds raw metric values to exactly 2 decimal places', () => {
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('28.46')).toBeInTheDocument()
    expect(screen.getByText('15.00')).toBeInTheDocument()
  })

  it('shows Your Position when an investment is passed', () => {
    const investment = { symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 }
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={investment} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('Your Position')).toBeInTheDocument()
  })

  it('does not crash when metrics is null', () => {
    render(<SymbolPanels symbol="AAPL" result={{ ...fullResult, metrics: null }} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
  })

  it('calls onResearchPeer when a peer chip is clicked', async () => {
    const onResearchPeer = vi.fn()
    render(<SymbolPanels symbol="AAPL" result={fullResult} investment={null} peers={['MSFT']} onResearchPeer={onResearchPeer} />)
    await userEvent.click(screen.getByRole('button', { name: 'MSFT' }))
    expect(onResearchPeer).toHaveBeenCalledWith('MSFT')
  })

  it('wraps every table in a horizontal scroll container so it cannot overflow the page on mobile', () => {
    // The Earnings History table only renders when earnings data is present.
    const withEarnings = {
      ...fullResult,
      earnings: { earnings: [{ period: '2024-12-31', actual: 2.4, estimate: 2.1 }] },
    }
    const { container } = render(<SymbolPanels symbol="AAPL" result={withEarnings} investment={null} peers={[]} onResearchPeer={vi.fn()} />)
    const tables = container.querySelectorAll('table')
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) {
      expect(table.parentElement).toHaveClass('symbol-table-wrap')
    }
  })
})

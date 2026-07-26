import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsCharts from './StatsCharts'

const emptyStats = {
  totalRealizedPnl: 0,
  winRate: 0,
  totalClosed: 0,
  totalOpen: 0,
  avgWin: 0,
  avgLoss: 0,
  bestTrade: null,
  worstTrade: null,
  stock: { count: 0, totalPnl: 0, winRate: 0, avgWin: 0, avgLoss: 0 },
  options: { count: 0, totalPnl: 0, winRate: 0, avgWin: 0, avgLoss: 0, totalPremiumCollected: 0 },
  byStrategy: [],
  bySymbol: [],
  equityCurve: [],
}

const filledStats = {
  ...emptyStats,
  totalClosed: 2,
  winRate: 50,
  byStrategy: [
    { strategy: 'call', label: 'Call', count: 1, totalPnl: 200, winRate: 100, avgWin: 200, avgLoss: 0 },
  ],
  bySymbol: [
    { symbol: 'AAPL', count: 1, totalPnl: 500 },
    { symbol: 'MSFT', count: 1, totalPnl: -100 },
  ],
  equityCurve: [
    { date: '2026-01-10', cumulative: 500 },
    { date: '2026-01-15', cumulative: 400 },
  ],
}

describe('StatsCharts', () => {
  it('renders a container with headings for all four charts', () => {
    render(<StatsCharts stats={filledStats} />)

    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
    expect(screen.getByText('Equity Curve')).toBeInTheDocument()
    expect(screen.getByText('P&L by Strategy')).toBeInTheDocument()
    expect(screen.getByText('Win / Loss')).toBeInTheDocument()
    expect(screen.getByText('P&L by Symbol')).toBeInTheDocument()
  })

  it('shows an empty message for a chart with no closed data', () => {
    render(<StatsCharts stats={emptyStats} />)

    expect(screen.getAllByText(/no closed trades yet/i).length).toBeGreaterThan(0)
  })

  it('does not show an empty message for charts that have data', () => {
    render(<StatsCharts stats={filledStats} />)

    const symbolSection = screen.getByText('P&L by Symbol').closest('.chart-card')
    expect(symbolSection.textContent).not.toMatch(/no closed trades yet/i)
  })
})

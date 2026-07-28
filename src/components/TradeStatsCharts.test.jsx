import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TradeStatsCharts from './TradeStatsCharts'

const emptyStats = {
  totalRealizedPnl: 0, winRate: 0, totalClosed: 0, avgWin: 0, avgLoss: 0,
  bestTrade: null, worstTrade: null, byType: [], bySymbol: [], equityCurve: [],
}

const filledStats = {
  ...emptyStats,
  totalClosed: 2,
  winRate: 50,
  byType: [{ type: 'Stock', count: 1, totalPnl: 200, winRate: 100, avgWin: 200, avgLoss: 0 }],
  bySymbol: [
    { symbol: 'AAPL', count: 1, totalPnl: 500 },
    { symbol: 'MSFT', count: 1, totalPnl: -100 },
  ],
  equityCurve: [
    { date: '2026-01-10', cumulative: 500 },
    { date: '2026-01-15', cumulative: 400 },
  ],
}

describe('TradeStatsCharts', () => {
  it('renders a container with headings for all four charts', () => {
    render(<TradeStatsCharts stats={filledStats} />)
    expect(screen.getByTestId('trade-stats-charts')).toBeInTheDocument()
    expect(screen.getByText('Equity Curve')).toBeInTheDocument()
    expect(screen.getByText('P&L by Type')).toBeInTheDocument()
    expect(screen.getByText('Win / Loss')).toBeInTheDocument()
    expect(screen.getByText('P&L by Symbol')).toBeInTheDocument()
  })

  it('shows empty-state text for charts with no data', () => {
    render(<TradeStatsCharts stats={emptyStats} />)
    expect(screen.getAllByText(/no closed trades yet/i).length).toBeGreaterThan(0)
  })
})

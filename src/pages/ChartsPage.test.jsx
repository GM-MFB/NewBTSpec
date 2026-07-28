import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ChartsPage from './ChartsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useWatchlist } from '../hooks/useWatchlist'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useWatchlist')
vi.mock('../components/TradingViewWidget', () => ({
  default: ({ symbol }) => <div data-testid="tv-widget">{symbol}</div>,
}))

function mockCommon({ entries = [] } = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'alice@example.com' }, signOut: vi.fn() })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
  })
  useWatchlist.mockReturnValue({ entries, loading: false, addEntry: vi.fn(), removeEntry: vi.fn() })
}

describe('ChartsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('defaults to AAPL when no stored symbol exists', () => {
    mockCommon()
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)
    expect(screen.getByTestId('tv-widget')).toHaveTextContent('AAPL')
  })

  it('restores the last-viewed symbol from localStorage', () => {
    localStorage.setItem('bt_charts_symbol', 'MSFT')
    mockCommon()
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)
    expect(screen.getByTestId('tv-widget')).toHaveTextContent('MSFT')
  })

  it('shows watchlist symbols ranked by watch count in the sidebar', () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'AAPL', note: null, createdAt: '2026-01-02' },
        { id: 'w3', userId: 'u1', displayName: 'Alice', symbol: 'TSLA', note: null, createdAt: '2026-01-03' },
      ],
    })
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    const rows = screen.getAllByTestId('charts-sidebar-row')
    expect(rows[0]).toHaveTextContent('AAPL')
    expect(rows[1]).toHaveTextContent('TSLA')
  })

  it('switches the chart symbol when a sidebar row is clicked', async () => {
    mockCommon({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'TSLA', note: null, createdAt: '2026-01-01' }],
    })
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    await userEvent.click(screen.getByTestId('charts-sidebar-row'))

    expect(screen.getByTestId('tv-widget')).toHaveTextContent('TSLA')
    expect(localStorage.getItem('bt_charts_symbol')).toBe('TSLA')
  })

  it('shows a placeholder message when the watchlist is empty', () => {
    mockCommon({ entries: [] })
    render(<MemoryRouter><ChartsPage /></MemoryRouter>)

    expect(screen.getByText(/no watchlist symbols yet/i)).toBeInTheDocument()
  })
})

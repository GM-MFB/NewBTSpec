import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import WatchlistPage from './WatchlistPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useUserSettings } from '../hooks/useUserSettings'
import { useWatchlist } from '../hooks/useWatchlist'
import { fetchWatchlistQuote } from '../lib/fetchWatchlistQuotes'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useUserSettings')
vi.mock('../hooks/useWatchlist')
vi.mock('../lib/fetchWatchlistQuotes')

function mockCommon({ entries = [] } = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'alice@example.com' }, signOut: vi.fn() })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
  })
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', displayName: 'Alice', loading: false })
  useWatchlist.mockReturnValue({ entries, loading: false, addEntry: vi.fn(), removeEntry: vi.fn() })
  fetchWatchlistQuote.mockResolvedValue({ price: 150, changePct: 1.5 })
}

describe('WatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the leaderboard sorted by most-watched first', async () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'AAPL', note: null, createdAt: '2026-01-02' },
        { id: 'w3', userId: 'u1', displayName: 'Alice', symbol: 'TSLA', note: null, createdAt: '2026-01-03' },
      ],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    const leaderboardRows = screen.getAllByTestId('leaderboard-row')
    expect(leaderboardRows[0]).toHaveTextContent('AAPL')
    expect(leaderboardRows[1]).toHaveTextContent('TSLA')
  })

  it('renders individual watchlists grouped by person', () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'TSLA', note: null, createdAt: '2026-01-02' },
      ],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('adds a new symbol via the form', async () => {
    const addEntry = vi.fn()
    mockCommon()
    useWatchlist.mockReturnValue({ entries: [], loading: false, addEntry, removeEntry: vi.fn() })

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/symbol/i), 'nvda')
    await userEvent.click(screen.getByRole('button', { name: /add to watchlist/i }))

    expect(addEntry).toHaveBeenCalledWith('NVDA', '', 'Alice')
  })

  it('does not add a duplicate symbol the current user already has', async () => {
    const addEntry = vi.fn()
    mockCommon({ entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }] })
    useWatchlist.mockReturnValue({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }],
      loading: false, addEntry, removeEntry: vi.fn(),
    })

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText(/symbol/i), 'aapl')
    await userEvent.click(screen.getByRole('button', { name: /add to watchlist/i }))

    expect(addEntry).not.toHaveBeenCalled()
  })

  it('shows a delete button only on the current user\'s own entries', () => {
    mockCommon({
      entries: [
        { id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' },
        { id: 'w2', userId: 'u2', displayName: 'Bob', symbol: 'TSLA', note: null, createdAt: '2026-01-02' },
      ],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(1)
  })

  it('shows live price and change % once fetched', async () => {
    mockCommon({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }],
    })
    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0))
    expect(screen.getAllByText('+1.50%').length).toBeGreaterThan(0)
  })

  it('shows placeholders instead of crashing when there is no Finnhub key', () => {
    mockCommon({
      entries: [{ id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: null, createdAt: '2026-01-01' }],
    })
    useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', displayName: 'Alice', loading: false })

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>)

    expect(fetchWatchlistQuote).not.toHaveBeenCalled()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TradesPage from './TradesPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'
import { generateTradeExcelWorkbook } from '../lib/tradeExcelExport'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useTrades')
vi.mock('../lib/tradeExcelExport')

function mockCommon({ trades = [] } = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
  useTrades.mockReturnValue({
    trades, loading: false, error: null, reload: vi.fn(),
    addTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn(),
  })
}

const closedTrade = {
  id: 't1', symbol: 'AAPL', type: 'stock', direction: 'long',
  quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-01-02',
  entryDate: '2026-01-02', fees: 0,
}

describe('TradesPage', () => {
  it('defaults to the Calendar tab, showing the calendar and the trade list', () => {
    mockCommon({ trades: [closedTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /^calendar$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('trade-calendar')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })

  it('sections the trade list by day, most recent day first', () => {
    const tradeDay1a = { ...closedTrade, id: 't1', symbol: 'AAPL', exitDate: '2026-07-27', entryDate: '2026-07-27' }
    const tradeDay1b = { ...closedTrade, id: 't2', symbol: 'MSFT', exitDate: '2026-07-27', entryDate: '2026-07-27' }
    const tradeDay2 = { ...closedTrade, id: 't3', symbol: 'TSLA', exitDate: '2026-07-20', entryDate: '2026-07-20' }
    mockCommon({ trades: [tradeDay1a, tradeDay1b, tradeDay2] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    const headings = screen.getAllByTestId('trade-day-heading')
    expect(headings).toHaveLength(2)
    expect(headings[0]).toHaveTextContent('July 27, 2026')
    expect(headings[1]).toHaveTextContent('July 20, 2026')

    const firstSection = headings[0].closest('section')
    expect(firstSection).toHaveTextContent('AAPL')
    expect(firstSection).toHaveTextContent('MSFT')
    expect(firstSection).not.toHaveTextContent('TSLA')
  })

  it('shows the day\'s total P&L next to the day heading', () => {
    const win = { ...closedTrade, id: 't1', exitDate: '2026-07-27', entryDate: '2026-07-27', entryPrice: 100, exitPrice: 110, quantity: 10 }
    mockCommon({ trades: [win] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    const heading = screen.getByTestId('trade-day-heading')
    expect(heading).toHaveTextContent('$100.00')
  })

  it('exports all trades to Excel when Export Excel is clicked, regardless of tab', async () => {
    mockCommon({ trades: [closedTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /export excel/i }))

    expect(generateTradeExcelWorkbook).toHaveBeenCalledWith([closedTrade])
  })

  it('shows the empty state on the Calendar tab when there are no trades', () => {
    mockCommon({ trades: [] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    expect(screen.getByText(/no trades yet/i)).toBeInTheDocument()
  })

  it('shows an error banner with a retry button when trades fail to load', async () => {
    mockCommon()
    const reload = vi.fn()
    useTrades.mockReturnValue({ trades: [], loading: false, error: { message: 'Network error' }, reload, addTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    expect(screen.getByText(/couldn.t load trades/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })

  it('switches to the Stats tab and shows stat tiles and charts', async () => {
    mockCommon({ trades: [closedTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^stats$/i }))

    expect(screen.getByText('Total Realized P&L')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByTestId('trade-stats-charts')).toBeInTheDocument()
    expect(screen.queryByTestId('trade-calendar')).not.toBeInTheDocument()
  })

  it('filters stats by the date range on the Stats tab', async () => {
    const olderTrade = { ...closedTrade, id: 't2', exitDate: '2025-01-01' }
    mockCommon({ trades: [closedTrade, olderTrade] })
    render(<MemoryRouter><TradesPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^stats$/i }))
    await userEvent.type(screen.getByLabelText(/from/i), '2026-01-01')

    expect(screen.getByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('opens Add Trade and calls addTrade on submit', async () => {
    const addTrade = vi.fn()
    mockCommon()
    useTrades.mockReturnValue({ trades: [], loading: false, error: null, reload: vi.fn(), addTrade, updateTrade: vi.fn(), deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /add trade/i }))
    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/quantity/i), '10')
    await userEvent.type(screen.getByLabelText(/entry price/i), '100')
    await userEvent.type(screen.getByLabelText(/exit price/i), '110')
    await userEvent.type(screen.getByLabelText(/^date$/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(addTrade).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }), 'u1')
  })

  it('opens the edit modal pre-filled and calls updateTrade on save', async () => {
    const updateTrade = vi.fn()
    mockCommon({ trades: [closedTrade] })
    useTrades.mockReturnValue({ trades: [closedTrade], loading: false, error: null, reload: vi.fn(), addTrade: vi.fn(), updateTrade, deleteTrade: vi.fn() })

    render(<MemoryRouter><TradesPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(updateTrade).toHaveBeenCalledWith('t1', expect.objectContaining({ symbol: 'AAPL' }))
  })
})

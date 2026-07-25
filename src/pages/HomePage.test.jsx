import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTrades } from '../hooks/useTrades'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useTrades')

describe('HomePage', () => {
  it('shows the empty state when there are no open trades', () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    useTrades.mockReturnValue({ trades: [], loading: false, error: null, reload: vi.fn(), addTrade: vi.fn(), closeTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn() })

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByText(/no open trades/i)).toBeInTheDocument()
  })

  it('shows an error banner with a retry button when trades fail to load', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    const reload = vi.fn()
    useTrades.mockReturnValue({ trades: [], loading: false, error: { message: 'Network error' }, reload, addTrade: vi.fn(), closeTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn() })

    const { default: userEvent } = await import('@testing-library/user-event')
    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByText(/couldn.t load trades/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })

  it('renders one TradeRow per open trade', () => {
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
      trades: [
        { id: 't1', symbol: 'AAPL', type: 'option', optionType: 'call', direction: 'long', quantity: 1, entryPrice: 5, entryDate: '2026-01-01' },
        { id: 't2', symbol: 'ES', type: 'futures', direction: 'short', quantity: 1, entryPrice: 4500, entryDate: '2026-01-02' },
      ],
      loading: false,
      error: null, reload: vi.fn(),
      addTrade: vi.fn(), closeTrade: vi.fn(), updateTrade: vi.fn(), deleteTrade: vi.fn(),
    })

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('ES')).toBeInTheDocument()
  })
})

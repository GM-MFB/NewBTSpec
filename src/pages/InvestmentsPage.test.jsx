import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvestmentsPage from './InvestmentsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestments')

function mockAccounts() {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
}

describe('InvestmentsPage', () => {
  it('shows the empty state when there are no open investments', () => {
    mockAccounts()
    useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn(), addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText(/no open investments/i)).toBeInTheDocument()
  })

  it('renders one InvestmentRow per open investment', () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: '', avgCost: '', strategy: 'covered_call', strike: 450, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('SPY')).toBeInTheDocument()
  })

  it('groups investments into a Stock section and Option sub-sections by strategy', () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: '', avgCost: '', strategy: 'covered_call', strike: 450, expiry: '2026-03-01' },
        { id: 'i3', symbol: 'QQQ', assetType: 'Option', shares: '', avgCost: '', strategy: 'cash_secured_put', strike: 380, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /^stock$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^option$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /covered call/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /cash secured put/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^put$/i })).not.toBeInTheDocument()
  })
})

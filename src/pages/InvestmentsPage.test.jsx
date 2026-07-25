import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('does not drop Option investments that have no strategy set', () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'NVDA', assetType: 'Option', shares: '', avgCost: '', strategy: '', strike: 900, expiry: '2026-04-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })

  it('opens the close position modal and calls closeInvestment on confirm', async () => {
    mockAccounts()
    const closeInvestment = vi.fn()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment, updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.getByLabelText(/closing price/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/closing price/i), '180')
    await userEvent.type(screen.getByLabelText(/^date$/i), '2026-02-01')
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(closeInvestment).toHaveBeenCalledWith('i1', { sellPrice: '180', sellDate: '2026-02-01' })
  })

  it('shows Covered Shares on the stock row for a matching covered call', () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 100, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    const coveredSharesItem = screen.getByText('Covered Shares:').closest('.meta-item')
    expect(coveredSharesItem).toHaveTextContent('100')
  })

  it('calls deleteInvestment when Delete is clicked', async () => {
    mockAccounts()
    const deleteInvestment = vi.fn()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment,
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(deleteInvestment).toHaveBeenCalledWith('i1')
  })
})

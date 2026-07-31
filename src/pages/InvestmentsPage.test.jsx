import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import InvestmentsPage from './InvestmentsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import { useUserSettings } from '../hooks/useUserSettings'
import { fetchQuote } from '../lib/finnhub'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestments')
vi.mock('../hooks/useUserSettings')
vi.mock('../lib/finnhub')

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
  useUserSettings.mockReturnValue({ finnhubKey: 'key123', loading: false, saveFinnhubKey: vi.fn() })
}

describe('Total Portfolio Worth', () => {
  const holdings = [
    { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 100, avgCost: 150, currentPrice: 165, strategy: '', strike: '', expiry: '' },
    { id: 'i2', assetType: 'Option', symbol: 'SPY', shares: 1, avgCost: 1.5, strategy: 'cash_secured_put', strike: 380, expiry: '2026-08-01' },
  ]

  function mockWith(cash, updateCash = vi.fn()) {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account', cash }],
      activeAccount: { id: 'a1', name: 'Main Account', cash },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      updateCash,
      loading: false,
    })
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', loading: false, saveFinnhubKey: vi.fn() })
    useInvestments.mockReturnValue({ investments: holdings, error: null, reload: vi.fn(), addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn() })
  }

  it('totals free cash, stock market value and option collateral', () => {
    mockWith(10000)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)
    // 10,000 cash + (100 x 165) stock + (380 x 100 x 1) collateral
    expect(screen.getByTestId('portfolio-worth')).toHaveTextContent('$64,500.00')
  })

  it('still totals correctly when no cash has been entered yet', () => {
    mockWith(0)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)
    expect(screen.getByTestId('portfolio-worth')).toHaveTextContent('$54,500.00')
  })

  it('seeds the cash field from the account and persists an edit on blur', async () => {
    const updateCash = vi.fn().mockResolvedValue(undefined)
    mockWith(10000, updateCash)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    const input = screen.getByLabelText(/free cash/i)
    expect(input).toHaveValue(10000)

    await userEvent.clear(input)
    await userEvent.type(input, '12500')
    fireEvent.blur(input)

    expect(updateCash).toHaveBeenCalledWith('a1', 12500)
  })

  it('expands into an allocation breakdown when the worth figure is clicked', async () => {
    mockWith(10000)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.queryByTestId('worth-breakdown')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /total portfolio worth/i }))

    const panel = screen.getByTestId('worth-breakdown')
    expect(panel).toHaveTextContent('Cash')
    expect(panel).toHaveTextContent('$10,000.00')
    expect(panel).toHaveTextContent('Stock')
    expect(panel).toHaveTextContent('$16,500.00')
    expect(panel).toHaveTextContent('Option Collateral')
    expect(panel).toHaveTextContent('$38,000.00')
  })

  it('shows each slice as a share of the total', async () => {
    mockWith(10000)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /total portfolio worth/i }))

    // 38,000 of 64,500 is 58.9%
    expect(screen.getByTestId('worth-breakdown')).toHaveTextContent('58.9%')
  })

  it('omits the long option row when there are no long options', async () => {
    mockWith(10000)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /total portfolio worth/i }))

    expect(screen.getByTestId('worth-breakdown')).not.toHaveTextContent(/long option/i)
  })

  it('does not write to the database when the value is unchanged', async () => {
    const updateCash = vi.fn()
    mockWith(10000, updateCash)
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    fireEvent.blur(screen.getByLabelText(/free cash/i))

    expect(updateCash).not.toHaveBeenCalled()
  })
})

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

  it('rolls an option position via the close modal', async () => {
    mockAccounts()
    const rollInvestment = vi.fn()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'SPY', assetType: 'Option', shares: 2, avgCost: 3.5, strategy: 'covered_call', strike: 560, expiry: '2026-07-18' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), rollInvestment, deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^roll$/i }))

    await userEvent.type(screen.getByLabelText(/close price/i), '1.10')
    await userEvent.type(screen.getByLabelText(/close date/i), '2026-07-10')
    await userEvent.type(screen.getByLabelText(/new credit received/i), '2.40')
    await userEvent.type(screen.getByLabelText(/new strike/i), '570')
    await userEvent.type(screen.getByLabelText(/new expiry/i), '2026-08-15')
    await userEvent.click(screen.getByRole('button', { name: /confirm roll/i }))

    expect(rollInvestment).toHaveBeenCalledWith('i1', {
      closePrice: '1.1', closeDate: '2026-07-10',
      newCredit: '2.4', newStrike: '570', newExpiry: '2026-08-15',
    }, 'u1')
  })

  it('opens the edit modal pre-filled and calls updateInvestment on save', async () => {
    mockAccounts()
    const updateInvestment = vi.fn()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, buyDate: '2026-01-01', strategy: '', strike: '', expiry: '' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment, deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')

    const sharesInput = screen.getByLabelText(/shares/i)
    await userEvent.clear(sharesInput)
    await userEvent.type(sharesInput, '20')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(updateInvestment).toHaveBeenCalledWith('i1', expect.objectContaining({ shares: '20' }))
  })

  it('shows Shares as owned/required on the stock row for a matching covered call', () => {
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

    expect(screen.getByText('100/100')).toBeInTheDocument()
  })

  it('shows portfolio summary stats when there are open investments', () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: 160, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'QQQ', assetType: 'Option', shares: 2, avgCost: 1.5, strategy: 'cash_secured_put', strike: 380, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    const summaryBar = screen.getByText('Total Collateral Deployed').closest('.portfolio-summary')
    expect(summaryBar).toHaveTextContent('$76,000.00')
    expect(summaryBar).toHaveTextContent('Outstanding Option Premium')
    expect(summaryBar).toHaveTextContent('$300.00')
    expect(summaryBar).toHaveTextContent('Unrealized Stock P&L')
    expect(summaryBar).toHaveTextContent('$100.00')
  })

  it('shows the premium-for-week selector and updates the total when the week changes', async () => {
    mockAccounts()
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'QQQ', assetType: 'Option', shares: 2, avgCost: 1.5, strategy: 'cash_secured_put', strike: 380, expiry: '2026-01-28' },
        { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 450, expiry: '2026-02-10' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    const weekInput = screen.getByLabelText(/premium for week/i)
    fireEvent.change(weekInput, { target: { value: '2026-W05' } })

    const bar = weekInput.closest('.summary-stat')
    expect(bar).toHaveTextContent('$300.00')
  })

  it('hides the portfolio summary when there are no open investments', () => {
    mockAccounts()
    useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn(), addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.queryByText('Total Collateral Deployed')).not.toBeInTheDocument()
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

  it('shows a missing-key message and does not fetch when Refresh is clicked with no key', async () => {
    mockAccounts()
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey: vi.fn() })
    useInvestments.mockReturnValue({
      investments: [{ id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    })

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))

    expect(screen.getByText(/add your finnhub api key/i)).toBeInTheDocument()
    expect(fetchQuote).not.toHaveBeenCalled()
  })

  it('fetches a quote per unique symbol and updates every matching investment', async () => {
    mockAccounts()
    const updateInvestment = vi.fn().mockResolvedValue(undefined)
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, expiry: '2026-03-01' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment, deleteInvestment: vi.fn(),
    })
    fetchQuote.mockResolvedValue(165.2)

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))

    await waitFor(() => expect(updateInvestment).toHaveBeenCalledTimes(2))
    expect(fetchQuote).toHaveBeenCalledWith('AAPL', 'key123')
    expect(updateInvestment).toHaveBeenCalledWith('i1', { currentPrice: 165.2 })
    expect(updateInvestment).toHaveBeenCalledWith('i2', { currentPrice: 165.2 })
  })

  it('shows which symbols failed to refresh without blocking the others', async () => {
    mockAccounts()
    const updateInvestment = vi.fn().mockResolvedValue(undefined)
    useInvestments.mockReturnValue({
      investments: [
        { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' },
        { id: 'i2', symbol: 'MSFT', assetType: 'Stock', shares: 5, avgCost: 300, strategy: '', strike: '', expiry: '' },
      ],
      loading: false, error: null, reload: vi.fn(),
      addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment, deleteInvestment: vi.fn(),
    })
    fetchQuote.mockImplementation((symbol) => (symbol === 'AAPL' ? Promise.resolve(165.2) : Promise.reject(new Error('fail'))))

    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))

    await waitFor(() => expect(screen.getByText(/couldn.t refresh msft/i)).toBeInTheDocument())
    expect(updateInvestment).toHaveBeenCalledWith('i1', { currentPrice: 165.2 })
  })
})

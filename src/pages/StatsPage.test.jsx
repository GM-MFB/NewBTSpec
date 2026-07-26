import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StatsPage from './StatsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestmentsHistory } from '../hooks/useInvestmentsHistory'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestmentsHistory')

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

const investments = [
  { id: 'i1', status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10' },
  { id: 'i2', status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, sellPrice: '', sellDate: '' },
]

describe('StatsPage', () => {
  it('shows the Numbers view by default with overview stat tiles', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText('Total Realized P&L')).toBeInTheDocument()
    expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Win Rate').length).toBeGreaterThan(0)
    expect(screen.getByText('Closed Positions')).toBeInTheDocument()
    expect(screen.getByText('Open Positions')).toBeInTheDocument()
  })

  it('switches to the Charts view when toggled', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^charts$/i }))

    expect(screen.queryByText('Total Realized P&L')).not.toBeInTheDocument()
    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
  })

  it('shows an error banner with retry when loading fails', async () => {
    mockAccounts()
    const reload = vi.fn()
    useInvestmentsHistory.mockReturnValue({ investments: [], loading: false, error: { message: 'fail' }, reload })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText(/couldn.t load stats/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })
})

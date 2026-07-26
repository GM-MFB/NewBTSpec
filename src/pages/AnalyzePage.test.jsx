import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AnalyzePage from './AnalyzePage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import { useUserSettings } from '../hooks/useUserSettings'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestments')
vi.mock('../hooks/useUserSettings')

function mockCommon() {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
  useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn() })
  useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', loading: false })
}

describe('AnalyzePage', () => {
  it('defaults to the Research tab', () => {
    mockCommon()
    render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /^research$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders Research first, followed by the other 7 tabs', () => {
    mockCommon()
    render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
    const labels = ['Research', 'Financials', 'DCF', 'Frontier', 'Optimizer', 'Risk', 'Wheel', 'Screener']
    const buttons = screen.getAllByRole('button', { name: new RegExp(`^(${labels.join('|')})$`, 'i') })
    expect(buttons.map((b) => b.textContent)).toEqual(labels)
  })

  it('shows a Coming soon placeholder for an unbuilt tab', async () => {
    mockCommon()
    render(<MemoryRouter><AnalyzePage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^dcf$/i }))
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})

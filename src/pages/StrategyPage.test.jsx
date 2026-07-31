import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StrategyPage from './StrategyPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { STRATEGY_CONTENT } from '../lib/strategyContent'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')

function renderPage() {
  return render(<MemoryRouter><StrategyPage /></MemoryRouter>)
}

describe('StrategyPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, signOut: vi.fn() })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
  })

  it('opens on the Wheel', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'The Wheel' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('strategy-article-wheel')).toBeInTheDocument()
  })

  it('offers a tab for every strategy', () => {
    renderPage()
    for (const strategy of STRATEGY_CONTENT) {
      expect(screen.getByRole('button', { name: strategy.name })).toBeInTheDocument()
    }
  })

  it('swaps the article when another strategy is selected', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Iron Condors' }))

    expect(screen.getByTestId('strategy-article-iron-condor')).toBeInTheDocument()
    expect(screen.queryByTestId('strategy-article-wheel')).not.toBeInTheDocument()
  })

  it('renders every required section for each strategy', async () => {
    renderPage()
    for (const strategy of STRATEGY_CONTENT) {
      await userEvent.click(screen.getByRole('button', { name: strategy.name }))
      for (const section of ['strategy-legs', 'strategy-key-facts', 'strategy-entry', 'strategy-management', 'strategy-mistakes', 'strategy-calculator']) {
        expect(screen.getByTestId(section), `${strategy.name} is missing ${section}`).toBeInTheDocument()
      }
    }
  })

  it('gives the Wheel its extra sections on cost basis and covered calls', () => {
    renderPage()
    const article = screen.getByTestId('strategy-article-wheel')
    // Targets the section headings — the covered-call rule is also referenced
    // in the management list, so a plain text query is ambiguous.
    expect(within(article).getByRole('heading', { name: /what assignment does to your cost basis/i })).toBeInTheDocument()
    expect(within(article).getByRole('heading', { name: /never sell a covered call below your cost basis/i })).toBeInTheDocument()
    expect(within(article).getByRole('heading', { name: /when the stock craters/i })).toBeInTheDocument()
  })

  it('recomputes the wheel calculator when an input changes', async () => {
    renderPage()
    const calculator = screen.getByTestId('strategy-calculator')

    expect(within(calculator).getByText('$38,000.00')).toBeInTheDocument()

    const strike = screen.getByLabelText('Strike')
    await userEvent.clear(strike)
    await userEvent.type(strike, '400')

    expect(within(calculator).getByText('$40,000.00')).toBeInTheDocument()
  })

  it('warns in the covered call calculator when the strike is below cost basis', async () => {
    renderPage()

    const callStrike = screen.getByLabelText('Call strike')
    await userEvent.clear(callStrike)
    await userEvent.type(callStrike, '370')

    // Basis defaults to 378, so a 370 call called away is a loss.
    expect(screen.getByText(/locks in this loss/i)).toBeInTheDocument()
  })

  it('draws the wheel cycle as a diagram rather than prose', () => {
    renderPage()
    expect(screen.getByTestId('wheel-cycle')).toBeInTheDocument()
  })

  it('renders a payoff chart for every strategy that has an expiration payoff', async () => {
    renderPage()
    for (const name of ['The Wheel', 'Credit Spreads', 'Debit Spreads', 'Iron Condors']) {
      await userEvent.click(screen.getByRole('button', { name }))
      expect(screen.getAllByText(/profit and loss at expiration/i).length, `${name} has no payoff chart`).toBeGreaterThan(0)
    }
  })

  it('draws no payoff chart for a calendar spread, which has no expiration payoff', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Calendar Spreads' }))
    expect(screen.queryByText(/profit and loss at expiration/i)).not.toBeInTheDocument()
  })

  it('states that a calendar spread has no calculable max profit', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Calendar Spreads' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('Not calculable')).toBeInTheDocument()
    expect(within(calculator).getByText(/implied volatility at the near expiry/i)).toBeInTheDocument()
  })

  it('computes the condor from its four strikes', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Iron Condors' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('$120.00')).toBeInTheDocument()
    expect(within(calculator).getByText('$380.00')).toBeInTheDocument()
  })
})

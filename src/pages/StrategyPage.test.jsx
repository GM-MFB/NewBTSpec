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
      for (const section of ['strategy-legs', 'strategy-key-facts', 'strategy-entry', 'strategy-management', 'strategy-mistakes']) {
        expect(screen.getByTestId(section), `${strategy.name} is missing ${section}`).toBeInTheDocument()
      }
      // A calculator only where the strategy has one. Volatility Risk Premium
      // is an approach rather than a structure, and giving it a calculator
      // would mean inventing a pricing model.
      if (strategy.calculator) {
        expect(screen.getByTestId('strategy-calculator'), `${strategy.name} is missing its calculator`).toBeInTheDocument()
      } else {
        expect(screen.queryByTestId('strategy-calculator')).not.toBeInTheDocument()
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

  it('shows an at-a-glance strip so strategies can be compared without reading', async () => {
    renderPage()
    for (const strategy of STRATEGY_CONTENT) {
      await userEvent.click(screen.getByRole('button', { name: strategy.name }))
      const glance = screen.getByTestId('strategy-glance')
      for (const label of ['Risk', 'Direction', 'Volatility', 'Capital', 'Legs']) {
        expect(within(glance).getByText(label), `${strategy.name} glance is missing ${label}`).toBeInTheDocument()
      }
    }
  })

  it('marks the wheel as undefined risk and the spreads as defined', async () => {
    renderPage()
    expect(within(screen.getByTestId('strategy-glance')).getByText('Undefined')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Credit Spreads' }))
    expect(within(screen.getByTestId('strategy-glance')).getByText('Defined')).toBeInTheDocument()
  })

  it('labels each leg as bought or sold so the structure reads at a glance', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Iron Condors' }))

    const legs = screen.getByTestId('strategy-legs')
    // A condor is two sold and two bought.
    expect(within(legs).getAllByText('Sell')).toHaveLength(2)
    expect(within(legs).getAllByText('Buy')).toHaveLength(2)
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

  it('groups the tabs by purpose', () => {
    const { container } = renderPage()
    // Scoped to the tab bar: 'Volatility' is also a label in the glance strip.
    const tabs = container.querySelector('.strategy-tabs')
    for (const group of ['Income', 'Directional', 'Neutral', 'Volatility', 'Protection']) {
      expect(within(tabs).getByText(group), `no ${group} tab group`).toBeInTheDocument()
    }
  })

  it('says a short strangle loss is unbounded rather than printing a number', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Strangles & Straddles' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('Unbounded')).toBeInTheDocument()
    expect(within(calculator).getByText(/no ceiling.*that is the point/i)).toBeInTheDocument()
  })

  it('says a long call profit is unbounded', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Long Calls & Puts' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('Unbounded')).toBeInTheDocument()
  })

  it('caps a protective put loss at the floor while leaving upside open', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Protective Puts & Collars' }))

    const calculator = screen.getByTestId('strategy-calculator')
    // basis 100, put 95, premium 2 -> floor of $700
    expect(within(calculator).getByText('$700.00')).toBeInTheDocument()
    expect(within(calculator).getByText('Unbounded')).toBeInTheDocument()
  })

  it('flags the pmcc ceiling as resting on both legs running to the long expiry', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /poor man/i }))

    expect(screen.getByText(/assumes both legs run to the long expiry/i)).toBeInTheDocument()
  })

  it('has a Hedge Fund group', () => {
    const { container } = renderPage()
    expect(within(container.querySelector('.strategy-tabs')).getByText('Hedge Fund')).toBeInTheDocument()
  })

  it('says a jade lizard has no upside risk when the credit covers the call width', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Jade Lizard' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('None')).toBeInTheDocument()
    expect(within(calculator).getByText(/no price above the calls can hurt you/i)).toBeInTheDocument()
  })

  it('warns that a covered strangle doubles the position on assignment', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Covered Strangle' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('200')).toBeInTheDocument()
    expect(within(calculator).getByText(/doubles the position/i)).toBeInTheDocument()
  })

  it('shows the tail hedge paying nothing until the drawdown passes the strike', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Tail Risk Hedging' }))

    const calculator = screen.getByTestId('strategy-calculator')
    // A 20% OTM put pays nothing on a 10% fall.
    const row = within(calculator).getByText('−10%').closest('tr')
    expect(row).toHaveTextContent('$0.00')
  })

  it('shows a buffer absorbing a fall inside it and capping the upside', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /defined outcome/i }))

    const calculator = screen.getByTestId('strategy-calculator')
    // 15% buffer: a 10% fall becomes 0%. 12% cap: a 30% rise becomes 12%.
    expect(within(calculator).getByText('-10%').closest('tr')).toHaveTextContent('0.0%')
    expect(within(calculator).getByText('+30%').closest('tr')).toHaveTextContent('+12.0%')
  })

  it('gives Volatility Risk Premium no calculator, since it is an approach not a structure', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /volatility risk premium/i }))

    expect(screen.queryByTestId('strategy-calculator')).not.toBeInTheDocument()
    expect(screen.getByTestId('strategy-key-facts')).toBeInTheDocument()
  })

  it('warns that a front ratio has an unbounded tail and a backspread does not', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /ratio spreads/i }))

    const calculator = screen.getByTestId('strategy-calculator')
    // Front ratio by default: the naked leg means the loss does not stop.
    expect(within(calculator).getByText('Unbounded')).toBeInTheDocument()
    expect(within(calculator).getByText(/one leg is naked/i)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Structure'), 'back')
    // Reversed: now the profit is the unbounded side.
    expect(within(screen.getByTestId('strategy-calculator')).getByText(/runs with the underlying/i)).toBeInTheDocument()
  })

  it('has a Gamma page explaining why the management rules exist', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Gamma' }))

    const article = screen.getByTestId('strategy-article-gamma')
    expect(within(article).getByRole('heading', { name: /long gamma vs short gamma/i })).toBeInTheDocument()
    expect(within(article).getByRole('heading', { name: /why gamma explodes near expiry/i })).toBeInTheDocument()
    expect(within(article).getByRole('heading', { name: /gamma scalping/i })).toBeInTheDocument()
    // A concept, not a structure — no calculator.
    expect(screen.queryByTestId('strategy-calculator')).not.toBeInTheDocument()
  })

  it('computes the condor from its four strikes', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Iron Condors' }))

    const calculator = screen.getByTestId('strategy-calculator')
    expect(within(calculator).getByText('$120.00')).toBeInTheDocument()
    expect(within(calculator).getByText('$380.00')).toBeInTheDocument()
  })
})

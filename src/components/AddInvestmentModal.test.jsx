import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddInvestmentModal from './AddInvestmentModal'

describe('AddInvestmentModal', () => {
  it('shows stock-only fields only when Stock is selected', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    expect(screen.getByLabelText(/shares/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/avg cost/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/strategy/i)).not.toBeInTheDocument()
  })

  it('shows the strategy dropdown when Option is selected, no strike_2 for non-spreads', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    expect(screen.getByLabelText(/strategy/i)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText(/strategy/i), 'covered_call')
    expect(screen.getByLabelText(/^strike$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/long leg strike/i)).not.toBeInTheDocument()
  })

  it('relabels Strike as Short Strike / Long Strike for credit spread strategies', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    await userEvent.selectOptions(screen.getByLabelText(/strategy/i), 'put_credit_spread')
    expect(screen.getByLabelText(/short strike/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^long strike$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^strike$/i)).not.toBeInTheDocument()
  })

  it('uppercases the symbol as it is typed', async () => {
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'aapl')
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
  })

  it('submits a stock investment with the expected fields', async () => {
    const onSubmit = vi.fn()
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/shares/i), '10')
    await userEvent.type(screen.getByLabelText(/avg cost/i), '150')
    await userEvent.type(screen.getByLabelText(/buy date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      assetType: 'Stock', symbol: 'AAPL', shares: '10', avgCost: '150', buyDate: '2026-01-01',
    }))
  })

  it('submits a put credit spread with both strikes', async () => {
    const onSubmit = vi.fn()
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'SPY')
    await userEvent.selectOptions(screen.getByLabelText(/strategy/i), 'put_credit_spread')
    await userEvent.type(screen.getByLabelText(/contracts/i), '2')
    await userEvent.type(screen.getByLabelText(/short strike/i), '400')
    await userEvent.type(screen.getByLabelText(/^long strike$/i), '395')
    await userEvent.type(screen.getByLabelText(/expiry/i), '2026-02-01')
    await userEvent.type(screen.getByLabelText(/^price$/i), '1.25')
    await userEvent.type(screen.getByLabelText(/buy date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      assetType: 'Option', symbol: 'SPY', strategy: 'put_credit_spread',
      shares: '2', strike: '400', strike2: '395', expiry: '2026-02-01', avgCost: '1.25',
    }))
  })

  it('pre-fills fields and shows the form immediately in edit mode, with the type toggle locked', async () => {
    const investment = {
      assetType: 'Stock', symbol: 'AAPL', name: 'Apple', sector: 'Tech',
      shares: 10, avgCost: 150, currentPrice: 165, stopLoss: 130, targetPrice: 200,
      buyDate: '2026-01-01', notes: 'long term', chartLink: 'tradingview.com/x',
    }
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} initialValues={investment} />)

    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
    expect(screen.getByLabelText(/shares/i)).toHaveValue(10)
    expect(screen.getByLabelText(/avg cost/i)).toHaveValue(150)
    expect(screen.getByRole('button', { name: /^stock$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^option$/i })).toBeDisabled()
  })

  it('submits the edited fields for an option investment', async () => {
    const onSubmit = vi.fn()
    const investment = {
      assetType: 'Option', symbol: 'SPY', strategy: 'covered_call',
      shares: 5, strike: 450, expiry: '2026-03-01', avgCost: 3.5, buyDate: '2026-01-01',
    }
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} initialValues={investment} />)

    const strikeInput = screen.getByLabelText(/^strike$/i)
    await userEvent.clear(strikeInput)
    await userEvent.type(strikeInput, '460')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      assetType: 'Option', symbol: 'SPY', strike: '460',
    }))
  })

  it('uses an "Edit Investment" dialog label in edit mode', () => {
    const investment = { assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, buyDate: '2026-01-01' }
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={vi.fn()} initialValues={investment} />)
    expect(screen.getByRole('dialog', { name: /edit investment/i })).toBeInTheDocument()
  })

  it('shows an inline error and keeps entered values when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('insert failed'))
    render(<AddInvestmentModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/shares/i), '10')
    await userEvent.type(screen.getByLabelText(/avg cost/i), '150')
    await userEvent.type(screen.getByLabelText(/buy date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/insert failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
  })
})

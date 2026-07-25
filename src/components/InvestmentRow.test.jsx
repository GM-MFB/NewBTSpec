import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentRow from './InvestmentRow'

describe('InvestmentRow', () => {
  it('renders symbol, Stock badge, shares, and avg cost inline for a stock', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('Shares:')).toBeInTheDocument()
    expect(screen.getByText('Avg Cost:')).toBeInTheDocument()
  })

  it('renders contracts, strike, expiry, and avg price inline for an option', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.getByText('Covered Call')).toBeInTheDocument()
    expect(screen.getByText('Contracts:')).toBeInTheDocument()
    expect(screen.getByText('Strike:')).toBeInTheDocument()
    expect(screen.getByText('Expires:')).toBeInTheDocument()
    expect(screen.getByText('Days Left:')).toBeInTheDocument()
    expect(screen.getByText('Avg Price:')).toBeInTheDocument()
  })

  it('formats the strike as short/long dollar amounts for a credit spread, no forced decimals', () => {
    const investment = { id: 'i5', symbol: 'SPY', assetType: 'Option', shares: 1, avgCost: 1.2, strategy: 'put_credit_spread', strike: 36, strike2: 35, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$36/$35')).toBeInTheDocument()
  })

  it('shows a single whole-dollar strike with no decimals for a non-spread strategy', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$450')).toBeInTheDocument()
  })

  it('shows decimals in the strike when the entered value has them', () => {
    const investment = { id: 'i8', symbol: 'SPY', assetType: 'Option', shares: 1, avgCost: 1, strategy: 'call', strike: 450.5, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$450.5')).toBeInTheDocument()
  })

  it('shows "Expired" for a past expiry and a day count for a future one', () => {
    const pastYear = new Date().getFullYear() - 1
    const futureYear = new Date().getFullYear() + 5
    const expired = { id: 'i3', symbol: 'OLD', assetType: 'Option', strategy: 'call', strike: 100, expiry: `${pastYear}-01-01` }
    const { rerender } = render(<InvestmentRow investment={expired} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()

    const future = { id: 'i4', symbol: 'NEW', assetType: 'Option', strategy: 'call', strike: 100, expiry: `${futureYear}-01-01` }
    rerender(<InvestmentRow investment={future} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/^\d+d$/)).toBeInTheDocument()
  })

  it('shows collateral and potential P&L as dollar amounts for a cash secured put', () => {
    const investment = { id: 'i6', symbol: 'QQQ', assetType: 'Option', shares: 2, avgCost: 1.5, strategy: 'cash_secured_put', strike: 380, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Collateral:')).toBeInTheDocument()
    expect(screen.getByText('$76,000')).toBeInTheDocument()
    expect(screen.getByText('P&L:')).toBeInTheDocument()
    expect(screen.getByText('$300.00')).toBeInTheDocument()
  })

  it('shows collateral using the strike width as a dollar amount for a credit spread', () => {
    const investment = { id: 'i5', symbol: 'SPY', assetType: 'Option', shares: 1, avgCost: 1.2, strategy: 'put_credit_spread', strike: 36, strike2: 35, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$120.00')).toBeInTheDocument()
  })

  it('does not show collateral or P&L for a long call/put', () => {
    const investment = { id: 'i7', symbol: 'TSLA', assetType: 'Option', shares: 1, avgCost: 5, strategy: 'call', strike: 300, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Collateral:')).not.toBeInTheDocument()
    expect(screen.queryByText('P&L:')).not.toBeInTheDocument()
  })

  it('shows a full coverage indicator when owned shares meet the requirement', () => {
    const investment = { id: 'i9', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} coverage={{ owned: 200, required: 100, ratio: 2 }} />)
    expect(screen.getByText('200/100 shares')).toBeInTheDocument()
    expect(screen.getByTestId('coverage-indicator')).toHaveClass('coverage-indicator--covered')
  })

  it('shows a partial coverage indicator when owned shares are half the requirement', () => {
    const investment = { id: 'i10', symbol: 'AAPL', assetType: 'Option', shares: 2, avgCost: 2, strategy: 'covered_call', strike: 200, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} coverage={{ owned: 100, required: 200, ratio: 0.5 }} />)
    expect(screen.getByText('100/200 shares')).toBeInTheDocument()
    expect(screen.getByTestId('coverage-indicator')).toHaveClass('coverage-indicator--partial')
  })

  it('shows a naked coverage indicator when no shares are owned', () => {
    const investment = { id: 'i11', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} coverage={{ owned: 0, required: 100, ratio: 0 }} />)
    expect(screen.getByText('0/100 shares')).toBeInTheDocument()
    expect(screen.getByTestId('coverage-indicator')).toHaveClass('coverage-indicator--naked')
  })

  it('does not show a coverage indicator when coverage is not provided', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByTestId('coverage-indicator')).not.toBeInTheDocument()
  })

  it('calls onClosePosition with the investment id when Close is clicked', async () => {
    const onClosePosition = vi.fn()
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={onClosePosition} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClosePosition).toHaveBeenCalledWith('i1')
  })

  it('calls onDelete with the investment id when Delete is clicked, with no confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const onDelete = vi.fn()
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith('i1')
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentRow from './InvestmentRow'

describe('InvestmentRow', () => {
  it('renders symbol, shares, and avg cost inline for a stock, with no asset-type badge', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('Stock')).not.toBeInTheDocument()
    expect(screen.getByText('Shares:')).toBeInTheDocument()
    expect(screen.getByText('Avg Cost:')).toBeInTheDocument()
  })

  it('shows Current Price on a stock row when set', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: 165, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Current Price:')).toBeInTheDocument()
    expect(screen.getByText('$165.00')).toBeInTheDocument()
  })

  it('does not show Current Price on a stock row when blank', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: '', strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Current Price:')).not.toBeInTheDocument()
  })

  it('renders contracts, strike, expiry, and avg price inline for an option, with no strategy badge', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.queryByText('Covered Call')).not.toBeInTheDocument()
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

  it('shows Shares as owned/required when coveredShares is provided', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 255, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} coveredShares={200} />)
    expect(screen.getByText('255/200')).toBeInTheDocument()
  })

  it('shows Shares as fully matched owned/required for one covered call', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 100, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} coveredShares={100} />)
    expect(screen.getByText('100/100')).toBeInTheDocument()
  })

  it('shows plain Shares value when coveredShares is not provided', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 200, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('shows Unrealized P&L on a stock row when current price is set', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 100, currentPrice: 165, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    const item = screen.getByText('Unrealized P&L:').closest('.meta-item')
    expect(item).toHaveTextContent('$650.00')
  })

  it('does not show Unrealized P&L on a stock row when current price is blank', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: '', strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Unrealized P&L:')).not.toBeInTheDocument()
  })

  it('colors stock Current Price and Unrealized P&L green when price is above avg cost', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 100, currentPrice: 165, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$165.00')).toHaveClass('price-favorable')
    const pnlItem = screen.getByText('Unrealized P&L:').closest('.meta-item')
    expect(pnlItem.querySelector('.meta-value')).toHaveClass('price-favorable')
  })

  it('colors stock Current Price and Unrealized P&L red when price is below avg cost', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, currentPrice: 140, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$140.00')).toHaveClass('price-unfavorable')
    expect(screen.getByText('-$100.00')).toHaveClass('price-unfavorable')
  })

  it('shows the underlying current price next to strike for an option', () => {
    const investment = { id: 'i9', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'call', strike: 30, currentPrice: 33.51, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$33.51')).toBeInTheDocument()
  })

  it('colors the current price green for a call when price is above strike (favorable)', () => {
    const investment = { id: 'i9', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'call', strike: 30, currentPrice: 33.51, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$33.51')).toHaveClass('price-favorable')
  })

  it('colors the current price red for a call when price is below strike (unfavorable)', () => {
    const investment = { id: 'i9', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'call', strike: 30, currentPrice: 28, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$28.00')).toHaveClass('price-unfavorable')
  })

  it('colors the current price green for a put when price is above strike (favorable)', () => {
    const investment = { id: 'i10', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'cash_secured_put', strike: 380, currentPrice: 400, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$400.00')).toHaveClass('price-favorable')
  })

  it('colors the current price red for a put when price is below strike (unfavorable)', () => {
    const investment = { id: 'i10', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'cash_secured_put', strike: 380, currentPrice: 360, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$360.00')).toHaveClass('price-unfavorable')
  })

  it('colors the current price green for a covered call when price is below strike (favorable — call stays OTM)', () => {
    const investment = { id: 'i11', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, currentPrice: 190, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$190.00')).toHaveClass('price-favorable')
  })

  it('colors the current price red for a covered call when price is above strike (unfavorable — assignment risk)', () => {
    const investment = { id: 'i11', symbol: 'AAPL', assetType: 'Option', shares: 1, avgCost: 2, strategy: 'covered_call', strike: 200, currentPrice: 210, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$210.00')).toHaveClass('price-unfavorable')
  })

  it('does not show a current price next to strike when not set', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('price-favorable')).not.toBeInTheDocument()
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

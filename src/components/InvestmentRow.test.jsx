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

  it('formats the strike as short/long dollar amounts for a credit spread', () => {
    const investment = { id: 'i5', symbol: 'SPY', assetType: 'Option', shares: 1, avgCost: 1.2, strategy: 'put_credit_spread', strike: 36, strike2: 35, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$36.00/$35.00')).toBeInTheDocument()
  })

  it('shows a single strike as a dollar amount for a non-spread strategy', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClosePosition={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('$450.00')).toBeInTheDocument()
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

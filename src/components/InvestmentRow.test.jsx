import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentRow from './InvestmentRow'

describe('InvestmentRow', () => {
  it('renders symbol, Stock badge, shares, and avg cost inline for a stock', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClick={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('Shares:')).toBeInTheDocument()
    expect(screen.getByText('Avg Cost:')).toBeInTheDocument()
  })

  it('renders contracts, strike, expiry, and avg price inline for an option', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: 5, avgCost: 3.5, strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClick={vi.fn()} />)
    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.getByText('Covered Call')).toBeInTheDocument()
    expect(screen.getByText('Contracts:')).toBeInTheDocument()
    expect(screen.getByText('Strike:')).toBeInTheDocument()
    expect(screen.getByText('Expires:')).toBeInTheDocument()
    expect(screen.getByText('Days Left:')).toBeInTheDocument()
    expect(screen.getByText('Avg Price:')).toBeInTheDocument()
  })

  it('shows "Expired" for a past expiry and a day count for a future one', () => {
    const pastYear = new Date().getFullYear() - 1
    const futureYear = new Date().getFullYear() + 5
    const expired = { id: 'i3', symbol: 'OLD', assetType: 'Option', strategy: 'call', strike: 100, expiry: `${pastYear}-01-01` }
    const { rerender } = render(<InvestmentRow investment={expired} onClick={vi.fn()} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()

    const future = { id: 'i4', symbol: 'NEW', assetType: 'Option', strategy: 'call', strike: 100, expiry: `${futureYear}-01-01` }
    rerender(<InvestmentRow investment={future} onClick={vi.fn()} />)
    expect(screen.getByText(/^\d+d$/)).toBeInTheDocument()
  })

  it('calls onClick with the investment id when clicked', async () => {
    const onClick = vi.fn()
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClick={onClick} />)
    await userEvent.click(screen.getByTestId('investment-row'))
    expect(onClick).toHaveBeenCalledWith('i1')
  })
})

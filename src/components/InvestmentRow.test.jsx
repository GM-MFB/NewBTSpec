import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentRow from './InvestmentRow'

describe('InvestmentRow', () => {
  it('renders symbol, Stock badge, shares, and avg cost for a stock', () => {
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClick={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('renders the strategy label and strike/expiry for an option', () => {
    const investment = { id: 'i2', symbol: 'SPY', assetType: 'Option', shares: '', avgCost: '', strategy: 'covered_call', strike: 450, expiry: '2026-03-01' }
    render(<InvestmentRow investment={investment} onClick={vi.fn()} />)
    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.getByText('Covered Call')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('calls onClick with the investment id when clicked', async () => {
    const onClick = vi.fn()
    const investment = { id: 'i1', symbol: 'AAPL', assetType: 'Stock', shares: 10, avgCost: 150, strategy: '', strike: '', expiry: '' }
    render(<InvestmentRow investment={investment} onClick={onClick} />)
    await userEvent.click(screen.getByTestId('investment-row'))
    expect(onClick).toHaveBeenCalledWith('i1')
  })
})

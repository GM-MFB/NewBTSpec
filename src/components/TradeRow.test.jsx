import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradeRow from './TradeRow'

const trade = {
  id: 't1', symbol: 'AAPL', type: 'option', optionType: 'call',
  direction: 'long', quantity: 2, entryPrice: 5.5, entryDate: '2026-01-01',
}

describe('TradeRow', () => {
  it('renders symbol, type badge, direction, entry price, and quantity', () => {
    render(<TradeRow trade={trade} onClick={vi.fn()} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText(/call/i)).toBeInTheDocument()
    expect(screen.getByText(/long/i)).toBeInTheDocument()
    expect(screen.getByText('5.5')).toBeInTheDocument()
  })

  it('calls onClick with the trade id when clicked', async () => {
    const onClick = vi.fn()
    render(<TradeRow trade={trade} onClick={onClick} />)
    await userEvent.click(screen.getByTestId('trade-row'))
    expect(onClick).toHaveBeenCalledWith('t1')
  })

  it('does not show a Delete button when onDelete is not provided', () => {
    render(<TradeRow trade={trade} onClick={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('calls onDelete with the trade id when Delete is clicked, without triggering onClick', async () => {
    const onClick = vi.fn()
    const onDelete = vi.fn()
    render(<TradeRow trade={trade} onClick={onClick} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith('t1')
    expect(onClick).not.toHaveBeenCalled()
  })
})

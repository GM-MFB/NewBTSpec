import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvestmentDetailModal from './InvestmentDetailModal'

const investment = {
  id: 'i1', assetType: 'Stock', symbol: 'AAPL', name: 'Apple', sector: 'Tech',
  shares: 10, avgCost: 150, buyDate: '2026-01-01', sellPrice: '', sellDate: '',
  stopLoss: '', targetPrice: '', chartLink: '', notes: '', status: 'open',
  strategy: '', strike: '', expiry: '', strike2: '',
}

describe('InvestmentDetailModal', () => {
  it('shows the investment fields', () => {
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={vi.fn()} onCloseInvestment={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()
  })

  it('calls onCloseInvestment with sell price and date when closing', async () => {
    const onCloseInvestment = vi.fn()
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={vi.fn()} onCloseInvestment={onCloseInvestment} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /close position/i }))
    await userEvent.type(screen.getByLabelText(/sell price/i), '180')
    await userEvent.type(screen.getByLabelText(/sell date/i), '2026-02-01')
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))

    expect(onCloseInvestment).toHaveBeenCalledWith({ sellPrice: '180', sellDate: '2026-02-01' })
  })

  it('calls onUpdate with edited fields when saving', async () => {
    const onUpdate = vi.fn()
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={onUpdate} onCloseInvestment={vi.fn()} onDelete={vi.fn()} />)

    const notes = screen.getByLabelText(/notes/i)
    await userEvent.type(notes, 'long term hold')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ notes: 'long term hold' }))
  })

  it('calls onDelete when delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={vi.fn()} onCloseInvestment={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('shows an inline error and keeps the form open when onUpdate rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('update failed'))
    render(<InvestmentDetailModal investment={investment} onClose={vi.fn()} onUpdate={onUpdate} onCloseInvestment={vi.fn()} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/update failed/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()
  })
})

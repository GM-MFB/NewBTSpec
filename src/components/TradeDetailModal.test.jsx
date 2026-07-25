import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradeDetailModal from './TradeDetailModal'

const trade = {
  id: 't1', type: 'futures', symbol: 'ES', direction: 'long', quantity: 1,
  entryPrice: 4500, entryDate: '2026-01-01', exitPrice: '', exitDate: '',
  fees: '', notes: '', chartLink: '', status: 'open',
  optionType: '', strike: '', expiry: '',
}

describe('TradeDetailModal', () => {
  it('shows the trade fields', () => {
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByDisplayValue('ES')).toBeInTheDocument()
  })

  it('calls onCloseTrade with exit price and date when closing', async () => {
    const onCloseTrade = vi.fn()
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={onCloseTrade} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /close trade/i }))
    await userEvent.type(screen.getByLabelText(/exit price/i), '4600')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-05')
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))

    expect(onCloseTrade).toHaveBeenCalledWith({ exitPrice: '4600', exitDate: '2026-01-05' })
  })

  it('calls onUpdate with edited fields when saving', async () => {
    const onUpdate = vi.fn()
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={onUpdate} onCloseTrade={vi.fn()} onDelete={vi.fn()} />)

    const notes = screen.getByLabelText(/notes/i)
    await userEvent.type(notes, 'good setup')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ notes: 'good setup' }))
  })

  it('calls onDelete when delete is clicked', async () => {
    const onDelete = vi.fn()
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('shows an inline error and keeps the form open when onUpdate rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('update failed'))
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={onUpdate} onCloseTrade={vi.fn()} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/update failed/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('ES')).toBeInTheDocument()
  })

  it('shows an inline error when onCloseTrade rejects', async () => {
    const onCloseTrade = vi.fn().mockRejectedValue(new Error('close failed'))
    render(<TradeDetailModal trade={trade} onClose={vi.fn()} onUpdate={vi.fn()} onCloseTrade={onCloseTrade} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /close trade/i }))
    await userEvent.type(screen.getByLabelText(/exit price/i), '4600')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-05')
    await userEvent.click(screen.getByRole('button', { name: /confirm close/i }))

    expect(await screen.findByText(/close failed/i)).toBeInTheDocument()
  })
})

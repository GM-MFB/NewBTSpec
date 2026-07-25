import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTradeModal from './AddTradeModal'

describe('AddTradeModal', () => {
  it('shows option-only fields only when Option is selected', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText(/strike/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    expect(screen.getByLabelText(/strike/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/expiry/i)).toBeInTheDocument()
  })

  it('submits a futures trade with only common fields', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ES')
    await userEvent.selectOptions(screen.getByLabelText(/direction/i), 'long')
    await userEvent.type(screen.getByLabelText(/quantity/i), '1')
    await userEvent.type(screen.getByLabelText(/entry price/i), '4500')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'futures', symbol: 'ES', direction: 'long', quantity: '1',
      entryPrice: '4500', entryDate: '2026-01-01',
    }))
  })

  it('submits an option trade including option fields', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.selectOptions(screen.getByLabelText(/direction/i), 'long')
    await userEvent.selectOptions(screen.getByLabelText(/option type/i), 'call')
    await userEvent.type(screen.getByLabelText(/strike/i), '200')
    await userEvent.type(screen.getByLabelText(/expiry/i), '2026-02-01')
    await userEvent.type(screen.getByLabelText(/quantity/i), '1')
    await userEvent.type(screen.getByLabelText(/entry price/i), '5.5')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'option', symbol: 'AAPL', optionType: 'call', strike: '200', expiry: '2026-02-01',
    }))
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<AddTradeModal onClose={onClose} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /close|cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an inline error and keeps entered values when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('insert failed'))
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ES')
    await userEvent.type(screen.getByLabelText(/quantity/i), '1')
    await userEvent.type(screen.getByLabelText(/entry price/i), '4500')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/insert failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('ES')
  })
})

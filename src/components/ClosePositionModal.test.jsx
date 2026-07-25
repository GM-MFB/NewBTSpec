import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClosePositionModal from './ClosePositionModal'

describe('ClosePositionModal', () => {
  it('shows Closing Price and Date fields', () => {
    render(<ClosePositionModal onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByLabelText(/closing price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^date$/i)).toBeInTheDocument()
  })

  it('calls onConfirm with sellPrice and sellDate on submit', async () => {
    const onConfirm = vi.fn()
    render(<ClosePositionModal onClose={vi.fn()} onConfirm={onConfirm} />)

    await userEvent.type(screen.getByLabelText(/closing price/i), '180')
    await userEvent.type(screen.getByLabelText(/^date$/i), '2026-02-01')
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(onConfirm).toHaveBeenCalledWith({ sellPrice: '180', sellDate: '2026-02-01' })
  })

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    render(<ClosePositionModal onClose={onClose} onConfirm={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an inline error and keeps the modal open when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('close failed'))
    render(<ClosePositionModal onClose={vi.fn()} onConfirm={onConfirm} />)

    await userEvent.type(screen.getByLabelText(/closing price/i), '180')
    await userEvent.type(screen.getByLabelText(/^date$/i), '2026-02-01')
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(await screen.findByText(/close failed/i)).toBeInTheDocument()
  })
})

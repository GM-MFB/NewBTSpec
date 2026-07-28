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

  it('does not show a Roll toggle for a stock position', () => {
    render(<ClosePositionModal investment={{ assetType: 'Stock' }} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^roll$/i })).not.toBeInTheDocument()
  })

  it('shows a Close/Roll toggle for an option position', () => {
    render(<ClosePositionModal investment={{ assetType: 'Option' }} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^roll$/i })).toBeInTheDocument()
  })

  it('switches to the roll form and submits it via onRoll', async () => {
    const onRoll = vi.fn()
    render(<ClosePositionModal investment={{ assetType: 'Option' }} onClose={vi.fn()} onConfirm={vi.fn()} onRoll={onRoll} />)

    await userEvent.click(screen.getByRole('button', { name: /^roll$/i }))

    await userEvent.type(screen.getByLabelText(/close price/i), '1.10')
    await userEvent.type(screen.getByLabelText(/close date/i), '2026-07-10')
    await userEvent.type(screen.getByLabelText(/new credit received/i), '2.40')
    await userEvent.type(screen.getByLabelText(/new strike/i), '570')
    await userEvent.type(screen.getByLabelText(/new expiry/i), '2026-08-15')
    await userEvent.click(screen.getByRole('button', { name: /confirm roll/i }))

    expect(onRoll).toHaveBeenCalledWith({
      closePrice: '1.1', closeDate: '2026-07-10',
      newCredit: '2.4', newStrike: '570', newExpiry: '2026-08-15',
    })
  })

  it('shows an inline error and keeps entered values when onRoll rejects', async () => {
    const onRoll = vi.fn().mockRejectedValue(new Error('roll failed'))
    render(<ClosePositionModal investment={{ assetType: 'Option' }} onClose={vi.fn()} onConfirm={vi.fn()} onRoll={onRoll} />)

    await userEvent.click(screen.getByRole('button', { name: /^roll$/i }))
    await userEvent.type(screen.getByLabelText(/close price/i), '1.10')
    await userEvent.type(screen.getByLabelText(/close date/i), '2026-07-10')
    await userEvent.type(screen.getByLabelText(/new credit received/i), '2.40')
    await userEvent.type(screen.getByLabelText(/new strike/i), '570')
    await userEvent.type(screen.getByLabelText(/new expiry/i), '2026-08-15')
    await userEvent.click(screen.getByRole('button', { name: /confirm roll/i }))

    expect(await screen.findByText(/roll failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/new strike/i)).toHaveValue(570)
  })
})

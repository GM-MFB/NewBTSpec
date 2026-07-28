import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddTradeModal from './AddTradeModal'

describe('AddTradeModal', () => {
  it('shows a Stock type option alongside Option and Futures', () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^stock$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^option$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^futures$/i })).toBeInTheDocument()
  })

  it('requires exit price and exit date up front for a stock trade', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/quantity/i), '10')
    await userEvent.type(screen.getByLabelText(/entry price/i), '100')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.type(screen.getByLabelText(/exit price/i), '110')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-02')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'stock', symbol: 'AAPL', exitPrice: '110', exitDate: '2026-01-02',
    }))
  })

  it('shows option type/strike/expiry fields for an Option trade', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^option$/i }))
    expect(screen.getByLabelText(/option type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/strike/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/expiry/i)).toBeInTheDocument()
  })

  it('auto-fills the $ per Tick field for a recognized futures symbol', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'MES')
    expect(screen.getByLabelText(/\$ per tick/i)).toHaveValue(1.25)
  })

  it('leaves $ per Tick blank and editable for an unrecognized futures symbol', async () => {
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'ZZZZ')
    expect(screen.getByLabelText(/\$ per tick/i)).toHaveValue(null)
    await userEvent.type(screen.getByLabelText(/\$ per tick/i), '2.5')
    expect(screen.getByLabelText(/\$ per tick/i)).toHaveValue(2.5)
  })

  it('shows a Ticks field instead of Entry/Exit Price for a futures trade, and submits it', async () => {
    const onSubmit = vi.fn()
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^futures$/i }))
    expect(screen.queryByLabelText(/entry price/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/exit price/i)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/symbol/i), 'MES')
    await userEvent.type(screen.getByLabelText(/ticks/i), '-6')
    await userEvent.type(screen.getByLabelText(/quantity/i), '2')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'futures', symbol: 'MES', ticks: '-6', tickValue: 1.25, quantity: '2',
    }))
  })

  it('pre-fills fields and locks the type toggle in edit mode', () => {
    const trade = {
      type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10,
      entryPrice: 100, entryDate: '2026-01-01', exitPrice: 110, exitDate: '2026-01-02', fees: 0,
    }
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} initialValues={trade} />)

    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
    expect(screen.getByLabelText(/exit price/i)).toHaveValue(110)
    expect(screen.getByRole('button', { name: /^stock$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^option$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^futures$/i })).toBeDisabled()
  })

  it('uses an "Edit Trade" dialog label in edit mode', () => {
    const trade = { type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10, entryPrice: 100, entryDate: '2026-01-01', exitPrice: 110, exitDate: '2026-01-02', fees: 0 }
    render(<AddTradeModal onClose={vi.fn()} onSubmit={vi.fn()} initialValues={trade} />)
    expect(screen.getByRole('dialog', { name: /edit trade/i })).toBeInTheDocument()
  })

  it('shows an inline error and keeps entered values when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('insert failed'))
    render(<AddTradeModal onClose={vi.fn()} onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: /^stock$/i }))
    await userEvent.type(screen.getByLabelText(/symbol/i), 'AAPL')
    await userEvent.type(screen.getByLabelText(/quantity/i), '10')
    await userEvent.type(screen.getByLabelText(/entry price/i), '100')
    await userEvent.type(screen.getByLabelText(/entry date/i), '2026-01-01')
    await userEvent.type(screen.getByLabelText(/exit price/i), '110')
    await userEvent.type(screen.getByLabelText(/exit date/i), '2026-01-02')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/insert failed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')
  })
})
